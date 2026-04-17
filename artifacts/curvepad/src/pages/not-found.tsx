import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Zap } from "lucide-react";

export default function NotFound() {
  return (
    <div className="min-h-screen grid-bg flex items-center justify-center">
      <div className="text-center">
        <div className="w-16 h-16 rounded-full bg-primary/10 border border-primary/30 flex items-center justify-center mx-auto mb-6 neon-glow">
          <Zap className="w-8 h-8 text-primary" />
        </div>
        <h1 className="text-5xl font-bold text-foreground mb-2">404</h1>
        <p className="text-muted-foreground text-sm mb-6">This page doesn't exist on the curve.</p>
        <Link href="/">
          <Button size="sm" className="bg-primary text-primary-foreground hover:bg-primary/90">
            Go to Explore
          </Button>
        </Link>
      </div>
    </div>
  );
}
