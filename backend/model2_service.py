import base64
import io
from pathlib import Path

import cv2
import numpy as np
import onnxruntime as ort
from PIL import Image


MODEL_PATH = (
    Path(__file__).resolve().parent.parent
    / "ai"
    / "models"
    / "building_damage"
    / "model.onnx"
)

DAMAGE_CLASSES = {
    0: "no-damage",
    1: "minor-damage",
    2: "major-damage",
    3: "destroyed",
}


class Model2Service:
    def __init__(self):
        if not MODEL_PATH.exists():
            raise FileNotFoundError(
                f"Model 2 ONNX file not found: {MODEL_PATH}"
            )

        self.session = ort.InferenceSession(
            str(MODEL_PATH),
            providers=["CPUExecutionProvider"],
        )

        self.input_names = [
            input_info.name
            for input_info in self.session.get_inputs()
        ]

        self.output_names = [
            output_info.name
            for output_info in self.session.get_outputs()
        ]

        print("AIQuake Model 2 loaded")
        print("Model:", MODEL_PATH)
        print("Inputs:", self.input_names)
        print("Outputs:", self.output_names)

    @staticmethod
    def preprocess_image(image_path):
        image = Image.open(image_path).convert("RGB")

        image = image.resize(
            (512, 512),
            Image.Resampling.BILINEAR,
        )

        array = np.asarray(image).astype(np.float32)

        # Normalize to 0-1.
        array = array / 255.0

        # HWC -> CHW
        array = np.transpose(array, (2, 0, 1))

        # Add batch dimension.
        array = np.expand_dims(array, axis=0)

        return array

    @staticmethod
    def create_damage_overlay(post_image_path, damage_mask):
        """
        Create a visual overlay from the predicted class mask.

        Colors:
            no damage  -> green
            minor      -> yellow
            major      -> orange
            destroyed  -> red
        """

        post_image = Image.open(post_image_path).convert("RGB")
        post_image = post_image.resize(
            (512, 512),
            Image.Resampling.BILINEAR,
        )

        base = np.asarray(post_image).astype(np.uint8)

        overlay = base.copy()

        # BGR colors for OpenCV.
        colors = {
            0: (0, 180, 0),
            1: (0, 220, 255),
            2: (0, 140, 255),
            3: (0, 0, 255),
        }

        alpha = 0.45

        for class_id, color in colors.items():
            mask = damage_mask == class_id

            if not np.any(mask):
                continue

            color_array = np.zeros_like(base)
            color_array[:, :] = color[::-1]

            overlay[mask] = (
                base[mask] * (1.0 - alpha)
                + color_array[mask] * alpha
            ).astype(np.uint8)

        # Draw contours around damaged areas.
        damaged_mask = (
            (damage_mask == 1)
            | (damage_mask == 2)
            | (damage_mask == 3)
        ).astype(np.uint8)

        contours, _ = cv2.findContours(
            damaged_mask,
            cv2.RETR_EXTERNAL,
            cv2.CHAIN_APPROX_SIMPLE,
        )

        for contour in contours:
            if cv2.contourArea(contour) < 10:
                continue

            cv2.drawContours(
                overlay,
                [contour],
                -1,
                (255, 255, 255),
                1,
            )

        result_image = Image.fromarray(overlay)

        buffer = io.BytesIO()

        result_image.save(
            buffer,
            format="PNG",
        )

        encoded = base64.b64encode(
            buffer.getvalue()
        ).decode("utf-8")

        return f"data:image/png;base64,{encoded}"

    @staticmethod
    def mask_to_base64(damage_mask):
        """
        Store the raw predicted class mask as a PNG.

        Each pixel contains the class ID:
            0 = no-damage
            1 = minor-damage
            2 = major-damage
            3 = destroyed
        """

        mask_image = Image.fromarray(
            damage_mask.astype(np.uint8),
            mode="L",
        )

        buffer = io.BytesIO()

        mask_image.save(
            buffer,
            format="PNG",
        )

        encoded = base64.b64encode(
            buffer.getvalue()
        ).decode("utf-8")

        return f"data:image/png;base64,{encoded}"

    def predict_mask(self, pre_image_path, post_image_path):
        pre = self.preprocess_image(pre_image_path)
        post = self.preprocess_image(post_image_path)

        inputs = {}

        if "pre" in self.input_names:
            inputs["pre"] = pre

        if "post" in self.input_names:
            inputs["post"] = post

        outputs = self.session.run(
            self.output_names,
            inputs,
        )

        if not outputs:
            raise RuntimeError(
                "Model 2 returned no outputs."
            )

        logits = outputs[0]

        if logits.ndim != 4:
            raise RuntimeError(
                f"Unexpected Model 2 output shape: {logits.shape}"
            )

        # Expected:
        # [batch, classes, height, width]
        damage_mask = np.argmax(
            logits[0],
            axis=0,
        ).astype(np.uint8)

        return damage_mask

    def analyze_damage(
        self,
        pre_image_path,
        post_image_path,
    ):
        damage_mask = self.predict_mask(
            pre_image_path,
            post_image_path,
        )

        total_pixels = damage_mask.size

        damage_counts = {}

        damage_percentages = {}

        for class_id, class_name in DAMAGE_CLASSES.items():
            count = int(
                np.sum(damage_mask == class_id)
            )

            percentage = (
                (count / total_pixels) * 100
                if total_pixels
                else 0
            )

            damage_counts[class_name] = count

            damage_percentages[class_name] = round(
                percentage,
                2,
            )

        overlay = self.create_damage_overlay(
            post_image_path,
            damage_mask,
        )

        mask_png = self.mask_to_base64(
            damage_mask,
        )

        return {
            "model": "AIQuake Model 2",
            "input_size": [512, 512],
            "output_shape": [
                1,
                4,
                512,
                512,
            ],
            "damage_counts": damage_counts,
            "damage_percentages": damage_percentages,

            # Existing visualization.
            "damage_overlay": overlay,

            # NEW:
            # Raw class mask for the future GIS bridge.
            "damage_mask_png": mask_png,

            "damage_mask_classes": {
                "0": "no-damage",
                "1": "minor-damage",
                "2": "major-damage",
                "3": "destroyed",
            },
        }


# Loaded on first use: the 1.3 GB model file is not stored in git, and the rest of
# the app must still start without it.
_model2_service = None


def get_model2_service():
    global _model2_service
    if _model2_service is None:
        _model2_service = Model2Service()
    return _model2_service


def analyze_damage(
    pre_image_path,
    post_image_path,
):
    return get_model2_service().analyze_damage(
        pre_image_path,
        post_image_path,
    )