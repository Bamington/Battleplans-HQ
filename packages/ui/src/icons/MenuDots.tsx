interface Props {
  className?: string;
}

const MenuDots = ({ className }: Props) => (
  <svg
    viewBox="0 0 24 24"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    className={className}
    aria-hidden="true"
  >
    <circle cx="5" cy="12" r="2" stroke="currentColor" strokeWidth="1.5"/>
<circle cx="12" cy="12" r="2" stroke="currentColor" strokeWidth="1.5"/>
<circle cx="19" cy="12" r="2" stroke="currentColor" strokeWidth="1.5"/>
  </svg>
);

export default MenuDots;
