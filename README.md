# Interfaz de Restaurante - SaaS de Pedidos y Pagos QR

Este proyecto es una aplicación web moderna diseñada para la gestión de pedidos en restaurantes (Mesa y Takeaway), con integración completa de pagos vía **Mercado Pago**, gestión de estados en tiempo real y persistencia de sesión inteligente.

## 🚀 Tecnologías Utilizadas

* **Frontend:** React, TypeScript, Vite, Tailwind CSS, shadcn-ui.
* **Backend / BaaS:** Supabase (PostgreSQL, Auth, Realtime).
* **Edge Functions:** Deno (para procesamiento seguro de pagos).
* **Pagos:** Integración oficial con Mercado Pago (Checkout Pro).
* **Infraestructura:** Soporte para Cron Jobs (Limpieza automática de base de datos).

---

## 🛠️ Instalación y Configuración Local

Si deseas correr este proyecto localmente para desarrollo o pruebas:

**Requisitos:** Tener instalado [Node.js](https://nodejs.org/).

1.  **Clonar el repositorio:**
    ```sh
    git clone <TU_URL_DEL_REPO>
    cd interfaz-main
    ```

2.  **Instalar dependencias:**
    ```sh
    npm install
    ```

3.  **Configurar Variables de Entorno:**
    Crea un archivo `.env` en la raíz del proyecto y agrega tus llaves de Supabase:
    ```env
    VITE_SUPABASE_URL=tu_url_de_supabase
    VITE_SUPABASE_ANON_KEY=tu_anon_key
    ```

4.  **Iniciar el servidor de desarrollo:**
    ```sh
    npm run dev
    ```
    La app correrá en `http://localhost:8080` (o el puerto que indique la consola).

---

## 🧪 Guía de Testeo para el Cliente (QA)

Esta guía permite verificar las funcionalidades críticas implementadas y auditadas (Seguridad, Pagos y Recuperación).

### 1. Prueba de "Happy Path" (Compra Exitosa)
*Objetivo: Verificar que el flujo de compra, cobro y confirmación funciona correctamente.*

1.  Abrir la app y agregar productos al carrito.
2.  Ir al Checkout y seleccionar **"Pagar con Mercado Pago"**.
3.  En la pasarela de Mercado Pago (Sandbox), usar los siguientes datos:
    * **Tarjeta:** Seleccionar "Nueva Tarjeta" -> Número: `4242 4242 4242 4242` (Visa).
    * **Nombre:** `APRO` (o cualquier nombre común).
    * **Fecha:** Cualquiera futura.
    * **CVV:** `123`.
4.  Confirmar pago.
5.  **Resultado Esperado:**
    * Redirección automática a la página de éxito (`/success`).
    * Mensaje verde de "Pedido Confirmado".
    * El carrito se vacía automáticamente.

### 2. Prueba de "Pago Rechazado" (Manejo de Errores)
*Objetivo: Verificar que el sistema no deje al usuario "tirado" si falla la tarjeta.*

1.  Crear un nuevo pedido.
2.  Ir a Mercado Pago.
3.  Ingresar los datos de tarjeta de prueba, pero en el **Nombre del Titular** escribir: **`RECH`**.
    * *Nota: `RECH` fuerza a Mercado Pago a rechazar la transacción.*
4.  Confirmar pago.
5.  Al ver el error en Mercado Pago, presionar "Volver al sitio" (o ir manualmente a `/success` si estás en localhost).
6.  **Resultado Esperado:**
    * Pantalla ROJA de "Pago Rechazado".
    * Botón visible para **"Reintentar Pago"** (sin perder el pedido).
    * El pedido sigue existiendo en la base de datos como `payment_status: rejected`.

### 3. Prueba de "Zombie Orders" (Persistencia y Recuperación)
*Objetivo: Verificar que si el usuario cierra la pestaña, no pierde su pedido.*

1.  Llenar el carrito y dar clic en "Pagar" (esto crea la orden en la BD).
2.  **CERRAR la pestaña del navegador** antes de pagar.
3.  Volver a abrir `localhost:8080`.
4.  **Resultado Esperado:**
    * El sistema reconoce tu sesión.
    * Aparece un aviso flotante (Tracker) abajo a la derecha mostrando el pedido pendiente.
    * El botón del tracker dice **"Pagar Ahora"** (permitiendo retomar el flujo sin empezar de cero).

---

## 🛡️ Auditoría de Seguridad Implementada

Este repositorio incluye parches de seguridad críticos aplicados recientemente:

* **Backend Price Validation:** El precio a cobrar se recalcula estrictamente en el servidor (Edge Function) ignorando lo que envíe el frontend, evitando manipulaciones maliciosas del monto.
* **Webhook Spoofing Protection:** Verificación de doble vía con la API de Mercado Pago para confirmar el estado real de los pagos.
* **Database Hygiene:** Implementación de un `Cron Job` en Supabase que elimina automáticamente órdenes "basura" (abandonadas y sin pagar) cada 4 horas.
* **GPS Return Logic:** Sistema de recuperación de coordenadas (`restaurant_id`, `table_id`) para asegurar que el usuario siempre vuelva al menú correcto después de pagar, incluso si falla la navegación del navegador.

---

## 📂 Estructura del Proyecto

* `/src`: Código fuente Frontend (React).
* `/supabase/functions`: Código Backend (Edge Functions de Deno).
* `/src/hooks`: Lógica de negocio reutilizable (Manejo de órdenes, carritos, sesión).
* `/src/components`: Componentes de UI (shadcn-ui).

---

* version de testeo *