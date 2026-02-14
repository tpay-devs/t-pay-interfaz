# Guía de Pruebas Manuales - App de Pedidos

## 1. Flujo Mesa (Escaneo QR)

### 1.1 Acceso y Menú
- [ ] Escanear código QR de una mesa válida
- [ ] Verificar que se muestra el nombre del restaurante
- [ ] Verificar que se muestra "Mesa #X" en el header
- [ ] Navegar por las categorías del menú
- [ ] Ver detalle de un producto

### 1.2 Carrito y Pedido
- [ ] Agregar productos al carrito
- [ ] Verificar que el contador del carrito se actualiza
- [ ] Ir al carrito
- [ ] Verificar que se muestra "Mesa #X" (no "Para llevar")
- [ ] Modificar cantidades
- [ ] Eliminar productos

---

## 2. Flujo Para Llevar (Takeaway)

### 2.1 Acceso
- [ ] Acceder con URL de takeaway (`/?id=rst_...`)
- [ ] Verificar que se muestra "Para llevar" en el header del menú
- [ ] Verificar que se muestra "Para llevar" en el checkout

### 2.2 Pago en Efectivo
- [ ] Agregar productos al carrito
- [ ] Ir al checkout
- [ ] Seleccionar pago en efectivo
- [ ] Confirmar pedido
- [ ] Verificar que se muestra la página de éxito con código de retiro
- [ ] Presionar "Volver al menú"
- [ ] **Verificar que el carrito está VACÍO** ⚠️

---

## 3. Pago con MercadoPago

### 3.1 Desde Mesa
- [ ] Agregar productos al carrito
- [ ] Seleccionar MercadoPago como método de pago
- [ ] Verificar que redirige a MercadoPago
- [ ] En MercadoPago: verificar que muestra el nombre del restaurante
- [ ] Completar pago (sandbox)
- [ ] Verificar que vuelve a la página de éxito
- [ ] Verificar que el Order Status Tracker aparece
- [ ] Presionar "Volver al menú"
- [ ] **Verificar que el carrito está VACÍO**
- [ ] **Verificar que el Order Status Tracker sigue visible** ⚠️

### 3.2 Desde Takeaway
- [ ] Repetir los pasos anteriores en modo takeaway
- [ ] Verificar que se muestra el código de retiro

---

## 4. Order Status Tracker

### 4.1 Visibilidad
- [ ] Después de pagar, verificar que aparece el botón flotante
- [ ] Verificar que muestra el estado correcto:
  - `pending` + unpaid → "Pendiente de pago"
  - `paid` → "Pagado"
  - `preparation` → "Preparando"
  - `ready_to_deliver` → "Listo para retirar"

### 4.2 Actualización en tiempo real
- [ ] Cambiar estado de la orden desde el admin
- [ ] Verificar que el tracker se actualiza (polling cada 30 segundos)

---

## 5. Navegación y Retorno

### 5.1 Volver al Menú desde Éxito
- [ ] Presionar "Volver al menú" después de pago exitoso
- [ ] Verificar que se carga el menú correcto (misma mesa/restaurante)
- [ ] Verificar que el carrito está vacío

### 5.2 Navegación del Navegador
- [ ] Usar botón "atrás" del navegador en diferentes puntos
- [ ] Verificar que no causa errores

---

## 6. Casos Especiales

### 6.1 Pago Pendiente MercadoPago
- [ ] Iniciar pago MP y cancelar/cerrar antes de pagar
- [ ] Volver a la app
- [ ] Verificar que la orden aparece como "Pendiente de pago"
- [ ] Usar botón de reintentar pago

### 6.2 Múltiples Pedidos
- [ ] Crear varios pedidos en la misma sesión
- [ ] Verificar que el tracker muestra el contador de pedidos
- [ ] Abrir el panel y ver lista de todos los pedidos

---

## Resultados Esperados

| Flujo | Estado Esperado |
|-------|-----------------|
| Mesa + MP | ✅ Funciona |
| Mesa + Efectivo | ✅ Funciona |
| Takeaway + MP | ✅ Funciona |
| Takeaway + Efectivo | ✅ Carrito se limpia |
| Order Tracker después de MP | ✅ Session ID persiste |
| Checkout muestra "Para llevar" | ✅ No dice "Mesa 0" |
