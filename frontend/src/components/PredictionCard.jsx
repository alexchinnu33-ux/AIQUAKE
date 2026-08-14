function PredictionCard({ prediction }) {

  return (

    <div
      style={{
        border: "1px solid #ddd",
        padding: "20px",
        borderRadius: "10px",
      }}
    >

      <h2>Prediction</h2>

      {prediction ? (

        <>

          <p>

            <strong>Prediction:</strong>

            {" "}

            {prediction.prediction}

          </p>

          <p>

            <strong>Confidence:</strong>

            {" "}

            {prediction.confidence}%

          </p>

        </>

      ) : (

        <p>No Prediction Yet</p>

      )}

    </div>

  );

}

export default PredictionCard;