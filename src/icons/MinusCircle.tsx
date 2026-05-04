interface Props {
  className?: string;
}

const MinusCircle = ({ className }: Props) => (
  <svg
    viewBox="0 0 24 24"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    className={className}
    aria-hidden="true"
  >
    <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="1.5"/>
<path d="M15 12H9" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
  </svg>
);

export default MinusCircle;
