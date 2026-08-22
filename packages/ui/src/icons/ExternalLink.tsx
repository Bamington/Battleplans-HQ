interface Props {
  className?: string;
}

const ExternalLink = ({ className }: Props) => (
  <svg
    viewBox="0 0 24 24"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    className={className}
    aria-hidden="true"
  >
    {/* The box, open at its top-right corner — the side the arrow leaves by. */}
    <path
      d="M21 12.5V15C21 18.3 21 19.9497 19.9749 20.9749C18.9497 22 17.2998 22 14 22H10C6.70017 22 5.05025 22 4.02513 20.9749C3 19.9497 3 18.2998 3 15V11C3 7.70017 3 6.05025 4.02513 5.02513C5.05025 4 6.70017 4 10 4H12"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
    />
    <path d="M20.5 3.5L11.5 12.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    <path
      d="M15.5 3H21V8.5"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
);

export default ExternalLink;
