interface Props {
  className?: string;
}

const ListCheck = ({ className }: Props) => (
  <svg
    viewBox="0 0 24 24"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    className={className}
    aria-hidden="true"
  >
    <path d="M14 16L16.1 18.5L20 13.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
<path d="M21 6L3 6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
<path d="M21 10L3 10" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
<path d="M10 14H3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
<path d="M10 18H3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
  </svg>
);

export default ListCheck;
