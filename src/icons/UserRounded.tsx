interface Props {
  className?: string;
}

const UserRounded = ({ className }: Props) => (
  <svg
    viewBox="0 0 24 24"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    className={className}
    aria-hidden="true"
  >
    <circle cx="12" cy="6" r="4" stroke="currentColor" strokeWidth="1.5"/>
<ellipse cx="12" cy="17" rx="7" ry="4" stroke="currentColor" strokeWidth="1.5"/>
  </svg>
);

export default UserRounded;
