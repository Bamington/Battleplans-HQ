interface Props {
  className?: string;
}

const Magnifer = ({ className }: Props) => (
  <svg
    viewBox="0 0 24 24"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    className={className}
    aria-hidden="true"
  >
    <circle cx="11.5" cy="11.5" r="9.5" stroke="currentColor" strokeWidth="1.5"/>
<path d="M18.5 18.5L22 22" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
  </svg>
);

export default Magnifer;
