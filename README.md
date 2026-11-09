# Naru Trips — MVP 1.0

Aplicación web responsive en React para seguimiento de presencialidad y planificación de viajes Cartagena (CTG) ↔ Bogotá (BOG).

## Ejecutar localmente

Requiere Node.js 18 o superior.

```bash
npm install
npm run dev
```

Abre la URL local que indique Vite.

## Compilar

```bash
npm run build
npm run preview
```

## Funcionalidades

- Objetivo de 20% de presencialidad en ventana móvil de tres meses.
- Historial propio desde noviembre de 2026.
- Ramp-up del MVP: noviembre = noviembre; diciembre = noviembre-diciembre; desde enero de 2027 = últimos tres meses.
- Cálculo de días computables excluyendo festivos, WFA y licencias registradas.
- Registro de asistencias, WFA y licencias.
- Calendario mensual.
- Gestión manual de festivos.
- Registro manual de vuelos de ida y regreso, con precio en COP y selección de vuelo directo.
- Datos persistidos en `localStorage`.

## Limitaciones deliberadas del MVP

- No consulta vuelos ni precios en vivo. Los vuelos se registran manualmente hasta conectar un proveedor/API y validar sus condiciones de acceso.
- Los festivos incluidos son una base editable. Verifica el calendario oficial y cuáles aplican a tu sede; el 16 de noviembre aparece marcado como festivo local de Cartagena y debe confirmarse para el cálculo corporativo.
- El redondeo del 20% se realiza hacia arriba para asegurar el mínimo matemático. Confirma si Employee Agent usa el mismo criterio.
- La lógica inicial desde noviembre es una convención solicitada para este registro personal y no garantiza que coincida con el cálculo oficial de transición de Employee Agent.
- La aplicación guarda los datos en el navegador/dispositivo actual; no hay sincronización entre dispositivos ni inicio de sesión.

## Regla usada

`días computables = días hábiles - festivos - WFA - licencias`

`asistencias requeridas = ceil(días computables × 0.20)`

Los registros de asistencia se cuentan dentro de la ventana. Un día marcado como festivo, WFA o licencia no suma como presencialidad.
