interface Props {
  className?: string;
}

const Camera = ({ className }: Props) => (
  <svg
    viewBox="0 0 24 24"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    className={className}
    aria-hidden="true"
  >
    <path d="M15.5 10C15.5 10 15.5 10 15.5 10C15.5 10 15.5 10 15.5 10Z" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
    <path d="M22 13V12C22 9.17157 22 7.75736 21.1213 6.87868C20.2426 6 18.8284 6 16 6H8C5.17157 6 3.75736 6 2.87868 6.87868C2 7.75736 2 9.17157 2 12V14C2 16.8284 2 18.2426 2.87868 19.1213C3.75736 20 5.17157 20 8 20H13" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
    <path d="M19 4L17 6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
    <circle cx="12" cy="13" r="3" stroke="currentColor" strokeWidth="1.5"/>
  </svg>
);

export default Camera;
