import { useState } from "react";
import api from "../services/api";

function UploadCard({ setPrediction }) {

  const [file, setFile] = useState(null);

  const uploadImage = async () => {

    if (!file) {
      alert("Please choose an image.");
      return;
    }

    const formData = new FormData();

    formData.append("file", file);

    try {

      const response = await api.post(
        "/predict",
        formData
      );

      setPrediction(response.data);

    } catch (error) {

    console.error(error);

    if (error.response) {
        alert(error.response.data.detail || "Server Error");
    } else {
        alert(error.message);
    }

}

  };

  return (

    <div
      style={{
        border: "1px solid #ddd",
        padding: "20px",
        borderRadius: "10px",
        marginBottom: "20px",
      }}
    >

      <h2>Upload Earthquake Image</h2>

      <input

        type="file"

        onChange={(e)=>setFile(e.target.files[0])}

      />

      <br/><br/>

      <button onClick={uploadImage}>

        Predict

      </button>

    </div>

  );

}

export default UploadCard;