export default function LoadingSpinner({ size = 'md', text = '' }) {
  return (
    <div className={`spinner-container spinner-${size}`}>
      <div className="spinner" />
      {text && <p className="spinner-text">{text}</p>}
    </div>
  )
}
