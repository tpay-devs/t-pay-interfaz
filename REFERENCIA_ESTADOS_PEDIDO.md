# Referencia de Estados del Pedido

## Estados que se muestran en el Tracker

| Valor de `status` | `payment_status` | Lo que ve el cliente | Ícono |
|-------------------|------------------|---------------------|-------|
| `pending` | `unpaid` o `pending` | "Pendiente de pago" | 💳 |
| `pending` | `paid` | "Enviado a cocina" | 🕐 |
| `paid` | — | "Pagado" | 🕐 |
| `preparation` | — | "Preparando" | 👨‍🍳 |
| `ready_to_deliver` | — | "Listo para retirar" | ✅ |

---

## Estados que ocultan el pedido del Tracker

Cuando el pedido tiene alguno de estos estados, **desaparece** del tracker del cliente:

| Valor de `status` | Descripción |
|-------------------|-------------|
| `cancelled` | Pedido cancelado por el staff (solo takeaway) |
| `customer_cancelled` | Pedido cancelado por el cliente |
| `delivered` | Pedido entregado |
| `completed` | Pedido finalizado |
| `refunded` | Se devolvió el pago |

---

## Flujo típico del pedido

```
pending → paid → preparation → ready_to_deliver → completed
   ↓
(desaparece del tracker)
```

---

## Tiempo de actualización

- El tracker consulta la base de datos cada **30 segundos**
- Solo muestra pedidos de los últimos **60 minutos**
