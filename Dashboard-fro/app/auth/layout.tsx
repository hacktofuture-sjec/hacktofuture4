export default function AuthLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <div className="w-screen min-h-screen overflow-hidden bg-black">
      {children}
    </div>
  )
}
