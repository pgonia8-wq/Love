import { Heart } from "lucide-react";
import { useLocation } from "wouter";

export default function NotFound() {
  const [, setLocation] = useLocation();

  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-6">
      <Heart className="w-12 h-12 text-love-pink mb-4" />
      <h1 className="text-2xl font-bold mb-2">Page not found</h1>
      <p className="text-muted-foreground mb-6">This page doesn't exist</p>
      <button
        onClick={() => setLocation("/")}
        className="gradient-love text-white px-6 py-2.5 rounded-xl font-medium"
      >
        Go Home
      </button>
    </div>
  );
}
