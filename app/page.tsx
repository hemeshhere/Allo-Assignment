"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";

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
  const router = useRouter();

  useEffect(() => {
    fetch("/api/products")
      .then((res) => res.json())
      .then((data) => setProducts(data))
      .finally(() => setLoading(false));
  }, []);

  async function handleReserve(productId: string, warehouseId: string) {
    try {
      // Generate a unique ID for this specific click
      const idempotencyKey = crypto.randomUUID();

      const res = await fetch("/api/reservations", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Idempotency-Key": idempotencyKey // <-- Send it to the API
        },
        body: JSON.stringify({ productId, warehouseId, quantity: 1 }),
      });

      const data = await res.json();

      if (res.status === 409) {
        toast.error("Race condition caught!", { description: data.error });
        return;
      }

      if (!res.ok) throw new Error();

      toast.success("Units reserved!");
      // Redirect to the checkout page with the reservation ID
      router.push(`/checkout/${data.id}`);
    } catch (error) {
      toast.error("Failed to reserve product.");
    }
  }

  if (loading) return <div className="p-10 text-center">Loading Inventory...</div>;

  return (
    <main className="container mx-auto py-10 px-4">
      <h1 className="text-4xl font-bold mb-8 tracking-tight">Allo Inventory</h1>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {products.map((product) => (
          <Card key={product.id} className="overflow-hidden border-2 hover:border-primary/50 transition-colors">
            <CardHeader>
              <CardTitle>{product.name}</CardTitle>
              <CardDescription>${(product.price / 100).toFixed(2)}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {product.inventory.map((inv) => (
                <div key={inv.warehouseId} className="flex items-center justify-between p-2 rounded-lg bg-muted/50">
                  <div>
                    <p className="text-sm font-medium">{inv.warehouse}</p>
                    <p className="text-xs text-muted-foreground">{inv.available} units available</p>
                  </div>
                  <Button 
                    size="sm" 
                    disabled={inv.available === 0}
                    onClick={() => handleReserve(product.id, inv.warehouseId)}
                  >
                    {inv.available === 0 ? "Out of Stock" : "Reserve"}
                  </Button>
                </div>
              ))}
            </CardContent>
          </Card>
        ))}
      </div>
    </main>
  );
}