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
      className="flex w-full items-center transition-opacity hover:opacity-90"
    >
      <img
        src="/kofi_brandasset/support_me_on_kofi_blue.png"
        alt={label}
        className="h-auto w-full rounded-md"
      />
    </a>
  );
}
