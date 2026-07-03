interface Props {
  className?: string;
}

const InfoCircle = ({ className }: Props) => (
  <svg
    viewBox="0 0 24 24"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    className={className}
    aria-hidden="true"
  >
    <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="1.5"/>
<path d="M12 17V11" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
<circle r="1" transform="matrix(1 0 0 -1 12 8)" fill="currentColor"/>
  </svg>
);

export default InfoCircle;
