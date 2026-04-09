type KofiSupportButtonProps = {
  username: string;
  label?: string;
};

export default function KofiSupportButton({
  username,
  label = "Support me on Ko-fi",
}: KofiSupportButtonProps) {
  return (
    <a
      href={`https://ko-fi.com/${username}`}
      target="_blank"
      rel="noopener noreferrer"
      aria-label={label}
      className="block w-full transition-opacity hover:opacity-90"
    >
      <img
        src="/kofi_brandasset/support_me_on_kofi_badge_blue.png"
        alt={label}
        className="block h-auto w-full"
      />
    </a>
  );
}
