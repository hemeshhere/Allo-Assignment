"use client";
import { useEffect, useState } from "react";
import { useRouter, useParams } from "next/navigation";
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { toast } from "sonner";
import { Clock } from "lucide-react";

export default function CheckoutPage() {
  const { id } = useParams();
  const router = useRouter();
  const [timeLeft, setTimeLeft] = useState<number>(0);

  useEffect(() => {
    // 1. In a real app, you'd fetch reservation details here. 
    // For this exercise, we can just track the timer.
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000).getTime(); // Mocking for UI
    
    const interval = setInterval(() => {
      const now = new Date().getTime();
      const distance = expiresAt - now;
      setTimeLeft(Math.max(0, distance));

      if (distance <= 0) {
        clearInterval(interval);
        toast.error("Reservation Expired", { description: "The units have been released." });
        router.push("/");
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [id, router]);

  const minutes = Math.floor((timeLeft % (1000 * 60 * 60)) / (1000 * 60));
  const seconds = Math.floor((timeLeft % (1000 * 60)) / 1000);
  const progressPercentage = (timeLeft / (10 * 60 * 1000)) * 100;

  async function handleAction(action: 'confirm' | 'release') {
    const res = await fetch(`/api/reservations/${id}/${action}`, { method: "POST" });
    const data = await res.json();

    if (res.status === 410) {
      toast.error("Too late!", { description: "This reservation already expired." });
    } else if (res.ok) {
      toast.success(action === 'confirm' ? "Order Placed!" : "Reservation Cancelled");
    }
    
    router.push("/");
  }

  return (
    <div className="flex items-center justify-center min-h-screen bg-zinc-950 p-4 relative overflow-hidden">
      
      {/* Background Glowing Orbs for Depth */}
      <div className="absolute top-1/4 left-1/4 w-[500px] h-[500px] bg-blue-500/10 rounded-full blur-[120px] pointer-events-none"></div>
      <div className="absolute bottom-1/4 right-1/4 w-[400px] h-[400px] bg-purple-500/10 rounded-full blur-[100px] pointer-events-none"></div>

      <Card className="w-full max-w-md border-zinc-800 bg-zinc-900/60 backdrop-blur-2xl shadow-2xl relative overflow-hidden z-10 animate-in zoom-in-95 duration-500">
        <CardHeader className="text-center pt-8">
          <div className="mx-auto bg-zinc-800/50 p-3 rounded-full w-fit mb-4 border border-zinc-700">
            <Clock className="w-6 h-6 text-blue-400" />
          </div>
          <CardTitle className="text-2xl font-bold text-slate-100">Secure Checkout</CardTitle>
          <p className="text-sm text-slate-400 mt-2">Your inventory is temporarily locked. Complete your purchase before the timer expires.</p>
        </CardHeader>
        
        <CardContent className="space-y-8 pb-8 ">
          <div className="text-center py-6 bg-zinc-950/50 rounded-2xl border border-red-800/80 shadow-inner">
            <p className={`text-6xl font-mono font-black tracking-tight drop-shadow-[0_0_15px_rgba(59,130,246,0.5)] ${timeLeft < 60000 ? 'text-red-400 drop-shadow-[0_0_15px_rgba(239,68,68,0.5)]' : 'text-slate-100'}`}>
              {String(minutes).padStart(2, '0')}:{String(seconds).padStart(2, '0')}
            </p>
            <p className="text-xs uppercase tracking-[0.2em] font-semibold text-slate-500 mt-4">Time Remaining</p>
          </div>
          
          <div className="space-y-2">
            <Progress
                value={progressPercentage}
                className="h-1.5 bg-zinc-800 [&>div]:bg-gradient-to-r [&>div]:from-blue-500 [&>div]:to-violet-500"
                />
          </div>
        </CardContent>

        <CardFooter className="flex flex-col gap-3 bg-zinc-900/40 border-t border-zinc-800/50 pt-6">
          <Button 
            className="w-full text-md py-6 bg-blue-600 hover:bg-blue-500 text-white shadow-[0_0_20px_rgba(37,99,235,0.4)] hover:shadow-[0_0_30px_rgba(59,130,246,0.6)] transition-all font-semibold" 
            size="lg" 
            onClick={() => handleAction('confirm')}
          >
            Confirm Purchase
          </Button>
          <Button 
            variant="outline" 
            className="w-full text-md py-6 bg-transparent border-zinc-700 text-slate-300 hover:bg-zinc-800 hover:text-white transition-all" 
            onClick={() => handleAction('release')}
          >
            Cancel & Release Stock
          </Button>
        </CardFooter>
      </Card>
    </div>
  );
}