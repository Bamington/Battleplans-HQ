interface Props {
  className?: string;
}

const Trophy = ({ className }: Props) => (
  <svg
    viewBox="0 0 24 24"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    className={className}
    aria-hidden="true"
  >
    {/* Cup */}
    <path
      d="M7 3.5H17V9.5C17 12.2614 14.7614 14.5 12 14.5C9.23858 14.5 7 12.2614 7 9.5V3.5Z"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinejoin="round"
    />
    {/* Handles */}
    <path
      d="M7 6H5.5C4.11929 6 3 7.11929 3 8.5C3 9.88071 4.11929 11 5.5 11H6.5"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
    />
    <path
      d="M17 6H18.5C19.8807 6 21 7.11929 21 8.5C21 9.88071 19.8807 11 18.5 11H17.5"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
    />
    {/* Stem and plinth */}
    <path d="M12 14.5V18" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    <path
      d="M8.5 21C8.5 21 9.5 18 10 18H14C14.5 18 15.5 21 15.5 21H8.5Z"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinejoin="round"
    />
  </svg>
);

export default Trophy;
