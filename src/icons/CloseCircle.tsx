interface Props {
  className?: string;
}

const CloseCircle = ({ className }: Props) => (
  <svg
    viewBox="0 0 24 24"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    className={className}
    aria-hidden="true"
  >
    <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="1.5"/>
<path d="M14.5 9.49999L9.5 14.5M9.49998 9.49997L14.5 14.4999" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
  </svg>
);

export default CloseCircle;
