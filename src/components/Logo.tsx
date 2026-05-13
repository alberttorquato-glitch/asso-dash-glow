import logo from "@/assets/pluraal-logo.png";

export function Logo({ className = "h-9 w-auto" }: { className?: string }) {
  return <img src={logo} alt="PLURAAL" className={className} />;
}
