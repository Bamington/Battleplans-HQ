interface Props {
  className?: string;
}

const UserRoundedBold = ({ className }: Props) => (
  <svg
    viewBox="0 0 24 24"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    className={className}
    aria-hidden="true"
  >
    <circle cx="12" cy="6" r="4" fill="currentColor"/>
<ellipse cx="12" cy="17" rx="7" ry="4" fill="currentColor"/>
  </svg>
);

export default UserRoundedBold;
