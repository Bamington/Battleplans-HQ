interface Props {
  className?: string;
}

const Microphone = ({ className }: Props) => (
  <svg
    viewBox="0 0 24 24"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    className={className}
    aria-hidden="true"
  >
    <path d="M7 8C7 5.23858 9.23858 3 12 3C14.7614 3 17 5.23858 17 8V11C17 13.7614 14.7614 16 12 16C9.23858 16 7 13.7614 7 11V8Z" stroke="currentColor" strokeWidth="1.5"/>
<path d="M13 8L17 8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
<path d="M13 11L17 11" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
<path d="M20 10V11C20 15.4183 16.4183 19 12 19C7.58172 19 4 15.4183 4 11V10" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
<path d="M12 19V22" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
  </svg>
);

export default Microphone;
