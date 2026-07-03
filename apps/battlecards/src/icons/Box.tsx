interface Props {
  className?: string;
}

const Box = ({ className }: Props) => (
  <svg
    viewBox="0 0 24 24"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    className={className}
    aria-hidden="true"
  >
    <path
      d="M3.27 6.96L12 12.01L20.73 6.96M12 22.08V12"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
    <path
      d="M20.49 7.5247L20.4923 16.5083C20.4923 16.7822 20.347 17.0354 20.1107 17.1735L12.4115 21.6739C12.1574 21.8225 11.8426 21.8225 11.5885 21.6739L3.88931 17.1735C3.65301 17.0354 3.50771 16.7822 3.50771 16.5083L3.50549 7.50156C3.50549 7.22772 3.65079 6.97449 3.88709 6.83641L11.5863 2.33599C11.8404 2.18743 12.1552 2.18743 12.4093 2.33599L20.1085 6.83641C20.3448 6.97449 20.49 7.22772 20.49 7.50156L20.4923 7.5247"
      stroke="currentColor"
      strokeWidth="1.5"
    />
  </svg>
);

export default Box;
