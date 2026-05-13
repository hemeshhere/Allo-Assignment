"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";
import { Loader2, Package } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

interface Product {
  id: string;
  name: string;
  price: number;
  inventory: {
    warehouse: string;
    warehouseId: string;
    available: number;
  }[];
}

export default function HomePage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedProductId, setExpandedProductId] = useState<string | null>(null);
  const [reservingId, setReservingId] = useState<string | null>(null);
  const router = useRouter();

  useEffect(() => {
    fetch("/api/products")
      .then((res) => res.json())
      .then((data) => setProducts(data))
      .finally(() => setLoading(false));
  }, []);

  async function handleReserve(productId: string, warehouseId: string) {
    try {
      // Trigger the Framer Motion animation by setting the expanded ID
      setExpandedProductId(productId);
      setReservingId(warehouseId);
      
      const idempotencyKey = crypto.randomUUID();

      const res = await fetch("/api/reservations", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Idempotency-Key": idempotencyKey 
        },
        body: JSON.stringify({ productId, warehouseId, quantity: 1 }),
      });

      const data = await res.json();

      if (res.status === 409) {
        toast.error("Race condition caught!", { description: data.error });
        setExpandedProductId(null);
        setReservingId(null);
        return;
      }

      if (!res.ok) throw new Error();

      toast.success("Units reserved!");
      
      // The single, correct routing call inside the timeout to let the animation play
      setTimeout(() => {
        router.push(`/checkout/${data.id}`);
      }, 400);

    } catch (error) {
      toast.error("Failed to reserve product.");
      setReservingId(null);
      setExpandedProductId(null);
    }
  }

  // A helper component to render the interior of the card with premium padding
  const ProductCardContent = ({ product, isExpanded = false }: { product: Product, isExpanded?: boolean }) => (
    <div className="p-1 sm:p-2"> 
      <CardHeader className="pb-6 pt-6 px-6 sm:px-8">
        <CardTitle className={`font-semibold text-slate-100 transition-colors ${isExpanded ? 'text-3xl' : 'text-xl group-hover:text-blue-400'}`}>
          {product.name}
        </CardTitle>
        <CardDescription className="text-lg font-medium text-slate-400 mt-2">
          ${(product.price / 100).toFixed(2)}
        </CardDescription>
      </CardHeader>
      
      <CardContent className="space-y-4 px-6 sm:px-8 pb-6 sm:pb-8">
        {product.inventory.map((inv) => (
          <div 
            key={inv.warehouseId} 
            className="flex items-center justify-between p-4 sm:p-5 rounded-2xl bg-zinc-950/60 border border-zinc-800/50 hover:bg-zinc-950/80 transition-colors"
          >
            <div>
              <p className="text-sm sm:text-base font-medium text-slate-300">{inv.warehouse}</p>
              <div className="flex items-center gap-2 mt-2">
                <span className="relative flex h-2.5 w-2.5">
                  {inv.available > 0 && <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-60"></span>}
                  <span className={`relative inline-flex rounded-full h-2.5 w-2.5 ${inv.available > 0 ? 'bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.8)]' : 'bg-red-500'}`}></span>
                </span>
                <p className={`text-xs sm:text-sm font-medium ${inv.available > 0 ? 'text-emerald-400/90' : 'text-red-400/90'}`}>
                  {inv.available} units available
                </p>
              </div>
            </div>
            
            <Button 
              size="sm" 
              disabled={inv.available === 0 || reservingId !== null}
              onClick={() => handleReserve(product.id, inv.warehouseId)}
              className={`w-28.75 py-5 font-semibold tracking-wide transition-all rounded-xl ${
                inv.available > 0 
                  ? 'bg-blue-600 hover:bg-blue-500 text-white shadow-[0_0_15px_rgba(37,99,235,0.2)] hover:shadow-[0_0_25px_rgba(59,130,246,0.4)]' 
                  : 'bg-zinc-800/80 text-zinc-500'
              }`} 
            >
              {reservingId === inv.warehouseId ? (
                <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Wait</>
              ) : inv.available === 0 ? "Out of Stock" : "Reserve"}
            </Button>
          </div>
        ))}
      </CardContent>
    </div>
  );

  return (
    <main className="min-h-screen pb-20 selection:bg-blue-500/30">
      {/* Background Blur Overlay for when a card is expanded */}
      <AnimatePresence>
        {expandedProductId && (
          <motion.div 
            initial={{ opacity: 0 }} 
            animate={{ opacity: 1 }} 
            exit={{ opacity: 0 }} 
            className="fixed inset-0 z-40 bg-zinc-950/90 backdrop-blur-md"
          />
        )}
      </AnimatePresence>

      <div className="sticky top-0 z-30 px-4 py-4 mb-8 bg-zinc-950/70 backdrop-blur-xl border-b border-zinc-800">
        <div className="container mx-auto flex items-center gap-3">
          <div className="bg-blue-500/10 p-2 rounded-xl border border-blue-500/20 shadow-[0_0_15px_rgba(59,130,246,0.15)]">
            <Package className="h-6 w-6 text-blue-400" />
          </div>
          <h1 className="text-2xl font-bold tracking-tight bg-linear-to-r from-slate-100 to-slate-400 bg-clip-text text-transparent">
            Allo Logistics
          </h1>
        </div>
      </div>

      <div className="container mx-auto px-4 relative">
        {loading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {[1, 2, 3, 4, 5, 6].map((i) => (
              <div key={i} className="bg-zinc-900/40 border border-zinc-800 rounded-2xl p-2">
                 <div className="p-6">
                    <Skeleton className="h-8 w-3/4 mb-3 bg-zinc-800" />
                    <Skeleton className="h-5 w-1/4 bg-zinc-800" />
                 </div>
                 <div className="px-6 pb-6 space-y-4">
                    <Skeleton className="h-20 w-full rounded-2xl bg-zinc-800/50" />
                    <Skeleton className="h-20 w-full rounded-2xl bg-zinc-800/50" />
                 </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {products.map((product) => (
              <div key={product.id} className="relative">
                <motion.div
                  layoutId={`card-${product.id}`}
                  className={`bg-zinc-900/50 border border-zinc-800 rounded-2xl overflow-hidden backdrop-blur-sm group hover:border-blue-500/30 hover:shadow-[0_8px_30px_rgb(0,0,0,0.4)] ${expandedProductId === product.id ? 'opacity-0' : 'opacity-100'}`}
                >
                  <ProductCardContent product={product} />
                </motion.div>
                <AnimatePresence>
                  {expandedProductId === product.id && (
                    <motion.div
                      layoutId={`card-${product.id}`}
                      className="fixed left-0 right-0 mx-auto top-[15vh] z-50 w-full max-w-lg bg-zinc-900 border border-blue-500/50 rounded-3xl shadow-[0_0_80px_rgba(59,130,246,0.2)] overflow-hidden"
                      initial={{ scale: 0.95 }}
                      animate={{ scale: 1 }}
                      transition={{ type: "spring", bounce: 0.2, duration: 0.6 }}
                    >
                      <ProductCardContent product={product} isExpanded={true} />
                      <motion.div 
                        initial={{ width: "0%" }}
                        animate={{ width: "100%" }}
                        transition={{ duration: 1.5, ease: "linear" }}
                        className="h-1.5 bg-blue-500"
                      />
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            ))}
          </div>
        )}
      </div>
    </main>
  );
}