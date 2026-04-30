interface Props {
  className?: string;
}

const UserCircle = ({ className }: Props) => (
  <svg
    viewBox="0 0 24 24"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    className={className}
    aria-hidden="true"
  >
    <circle cx="12" cy="9" r="3" stroke="currentColor" strokeWidth="1.5"/>
<circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="1.5"/>
<path d="M17.9692 20C17.8101 17.1085 16.9248 15 12 15C7.07527 15 6.18997 17.1085 6.03082 20" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
  </svg>
);

export default UserCircle;
