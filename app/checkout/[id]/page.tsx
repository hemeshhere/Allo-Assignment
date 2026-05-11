"use client";
import { useEffect, useState } from "react";
import { useRouter, useParams } from "next/navigation";
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { toast } from "sonner";

export default function CheckoutPage() {
  const { id } = useParams();
  const router = useRouter();
  const [reservation, setReservation] = useState<any>(null);
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
    <div className="flex items-center justify-center min-h-screen bg-muted/30 p-4">
      <Card className="w-full max-w-md shadow-xl">
        <CardHeader className="text-center">
          <CardTitle className="text-2xl">Complete Your Order</CardTitle>
          <p className="text-sm text-muted-foreground">We are holding these units for you.</p>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="text-center py-4">
            <p className="text-4xl font-mono font-bold">
              {String(minutes).padStart(2, '0')}:{String(seconds).padStart(2, '0')}
            </p>
            <p className="text-xs uppercase tracking-widest text-muted-foreground mt-2">Time Remaining</p>
          </div>
          <Progress value={(timeLeft / (10 * 60 * 1000)) * 100} className="h-2" />
        </CardContent>
        <CardFooter className="flex flex-col gap-3">
          <Button className="w-full" size="lg" onClick={() => handleAction('confirm')}>
            Confirm Purchase
          </Button>
          <Button variant="outline" className="w-full" onClick={() => handleAction('release')}>
            Cancel & Release Stock
          </Button>
        </CardFooter>
      </Card>
    </div>
  );
}