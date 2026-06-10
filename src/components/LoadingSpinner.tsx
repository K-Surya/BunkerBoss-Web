const LoadingSpinner = ({ message = "Loading..." }: { message?: string }) => (
  <div className="loading-screen">
    <div className="loading-spinner" />
    <p className="loading-text">{message}</p>
  </div>
);

export default LoadingSpinner;
