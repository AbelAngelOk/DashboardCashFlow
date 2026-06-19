# 09 — Glosario

## Términos Financieros

### Activo
Bien o derecho de valor económico que posee el usuario. En el sistema, cualquier inversión o propiedad registrada bajo el tipo `"activo"` en el Balance. Incluye acciones, cripto, plazos fijos, bonos, participación en bots, etc.

### Pasivo / Obligación
Deuda o compromiso financiero que el usuario tiene pendiente. En el sistema se llama `"pasivo"` en el código pero "Obligación" en la UI. Aparece en la sección BALANCE junto a los activos.

### Ingreso
Flujo de dinero que entra al patrimonio del usuario en un período. En el sistema: `type: "ingreso"`. Aparece en el Estado de Resultados.

### Gasto
Flujo de dinero que sale del patrimonio del usuario en un período. En el sistema: `type: "gasto"`. Aparece en el Estado de Resultados.

### Flujo de Caja (Cash Flow)
Diferencia entre ingresos y gastos en un período: `Ingresos - Gastos`. El sistema lo calcula por moneda o en moneda base si la conversión está activa.

### Estado de Resultados
Informe financiero que muestra ingresos y gastos, y el saldo resultante (flujo de caja). En el sistema corresponde a la sección superior del dashboard con las tablas "Ingresos" y "Gastos" más el panel "Auditor".

### Balance
Informe que presenta la situación patrimonial: activos vs. pasivos. En el sistema corresponde a la sección inferior del dashboard con las tablas "Activos" y "Obligaciones".

### Snapshot
"Fotografía" del estado financiero en un momento determinado. Captura el Estado de Resultados y Balance actuales y los guarda para consulta histórica futura. En el sistema: objeto `Snapshot` con copia de los records.

### Moneda Base
La moneda de referencia elegida por el usuario para consolidar montos multi-moneda. Solo se usa cuando el modo de conversión de divisas está activo.

### Tipo de Cambio / Tasa de Cambio
Valor que indica cuántas unidades de la moneda base equivalen a 1 unidad de otra moneda. En el sistema: `rates[X] = cuántas unidades de baseCurrency equivalen a 1 X`.

### Precio Promedio Ponderado (PPP / avgBuyPrice)
Precio de compra promedio ajustado por cantidad al agregar nuevas compras: `(prevQty × prevAvg + newQty × newPrice) / (prevQty + newQty)`. Implementado en `calcWeightedAvgPrice()`.

### Dividendo
Distribución de ganancias que una empresa realiza a sus accionistas. En el sistema, el panel de acciones (STOCK) permite registrar dividendos estimados y reales por mes.

### Plazo Fijo (FIXED_TERM)
Instrumento de ahorro bancario donde se deposita capital por un plazo determinado a una tasa de interés fija. El sistema calcula el retorno esperado con la fórmula: `principal × (rate/100) × (days/365)`.

### Bono (BOND)
Instrumento de deuda emitido por empresas o gobiernos que paga intereses (cupones) periódicos y devuelve el capital al vencimiento. En el sistema: tiene un cronograma de "desembolsos" con fechas y montos.

### Desembolso (BondDisbursement)
Pago programado de un bono (cupón de interés o devolución de capital). Tiene fecha de vencimiento y puede marcarse como "cobrado".

### Futuros (FUTURES)
Contratos financieros que obligan a comprar o vender un activo en una fecha futura a un precio pactado. El sistema distingue posiciones LONG (apuesta al alza) y SHORT (apuesta a la baja).

### Opciones (OPTIONS)
Derivados financieros que otorgan el derecho (sin obligación) de comprar o vender un activo a un precio determinado. En el sistema existe el tipo pero no tiene panel específico diferenciado.

### Bot de Trading (TRADING_BOT)
Sistema automatizado que ejecuta operaciones de compra/venta según estrategias programadas. El sistema no interactúa con el bot; solo registra sus resultados agregados.

### Bot de Rebalanceo (REBALANCE_BOT)
Bot que mantiene proporciones target entre distintos activos de un portafolio, comprando y vendiendo para rebalancear. El sistema simula aportes y extracciones proporcionales entre los activos del bot.

### ROI (Return on Investment)
Retorno sobre la inversión. En el bot de trading: `ROI = ((totalGained - totalLost) / totalInvested) × 100`.

### Trading (TRADING)
Compraventa activa de activos financieros para obtener ganancias en el corto o mediano plazo. En el sistema registra el monto invertido y el monto obtenido.

### Capital
El monto de dinero invertido inicialmente en un instrumento financiero, sin incluir las ganancias generadas.

### Ticker
Símbolo bursátil abreviado que identifica un activo en un mercado. Por ejemplo: AAPL (Apple), BTC (Bitcoin), BTCUSDT (Bitcoin contra Tether en Binance).

---

## Términos Técnicos

### App Router
Sistema de enrutamiento de Next.js basado en la estructura de carpetas `app/`. Soporta Server Components, layouts anidados, y Server Actions.

### Server Action
Función TypeScript marcada con `"use server"` que se ejecuta en el servidor de Next.js. Puede ser llamada directamente desde componentes cliente como si fuera una función local.

### Server Component
Componente React que se renderiza en el servidor. No puede tener estado ni event listeners. Puede llamar directamente a Server Actions y bases de datos.

### Client Component
Componente React marcado con `"use client"` que se renderiza en el navegador. Puede tener estado (`useState`), efectos (`useEffect`) y event handlers.

### React Context
Mecanismo de React para compartir estado entre componentes sin prop drilling. El sistema tiene dos contextos principales: `FinanceContext` y `SettingsContext`.

### Mutación Optimista
Técnica donde la UI se actualiza inmediatamente al realizar una acción, sin esperar la confirmación del servidor. Mejora la percepción de velocidad pero requiere manejo de errores si el servidor falla.

### Debounce
Técnica que retrasa la ejecución de una función hasta que transcurra un tiempo sin nuevas invocaciones. Usado en el sistema para diferir la escritura de comentarios a la DB por 600ms.

### Soft Delete
Eliminación lógica: en lugar de borrar el registro de la DB, se marca con `deletedAt = ahora`. El registro sigue existiendo pero se excluye de todas las consultas normales.

### JWT (JSON Web Token)
Token firmado digitalmente que contiene información del usuario (claims). NextAuth lo usa para mantener la sesión sin almacenar estado en el servidor.

### PgBouncer
Pool de conexiones para PostgreSQL. Supabase lo usa en modo "transacción" (cada query puede usar una conexión diferente del pool), lo que no es compatible con transacciones interactivas multi-statement.

### Prisma
ORM (Object-Relational Mapper) para Node.js/TypeScript. Provee un cliente tipado para interactuar con la base de datos y gestiona el schema de la DB.

### shadcn/ui
Librería de componentes de UI para React, basada en Radix UI (accesibilidad) y Tailwind CSS (estilos). Los componentes se copian al proyecto en lugar de instalarse como dependencia opaca.

### Radix UI
Librería de primitivos de UI accesibles sin estilos. Base de shadcn/ui.

### Tailwind CSS
Framework de CSS utilitario. La versión 4 usada en el proyecto configura los estilos en `app/globals.css` en lugar de `tailwind.config.js`.

### Middleware (Next.js)
Función que se ejecuta en el Edge (CDN) antes de que cada request llegue a la página. En el sistema (`proxy.ts`), verifica la autenticación y redirige a `/login` si no hay sesión válida.

### bcrypt
Algoritmo de hashing diseñado específicamente para contraseñas. Es lento por diseño (el "factor de trabajo" controla cuánto tiempo tarda) para resistir ataques de fuerza bruta.

### USDT (Tether)
Stablecoin (cripto-moneda estable) anclada al valor del dólar estadounidense. 1 USDT ≈ 1 USD. Popular en trading de criptomonedas. No es una divisa ISO oficial.

### ARS
Código ISO 4217 del Peso Argentino.

### UUID
Identificador único universal (Universally Unique Identifier). El sistema usa `crypto.randomUUID()` para generar IDs únicos del lado del cliente para records y snapshots.

### Vercel
Plataforma de deployment en la nube optimizada para Next.js. El sistema usa Vercel Analytics e implícitamente está diseñado para desplegarse en Vercel.

### Server-Side Rendering (SSR)
Renderizado de páginas en el servidor antes de enviarlas al cliente. Next.js App Router hace SSR por defecto para Server Components.

### TrackingConfig
Estructura de datos configurable por el usuario para agregar una tabla de seguimiento personalizada a cualquier activo. Permite definir columnas (texto, número, fecha) y agregar filas.

### isGroupParent
Flag booleano en `FinancialRecord` que indica si un activo es el "padre" de un grupo de activos. Se deriva de `_count.children > 0` en la query de Supabase.

### linkedTo
Campo opcional en `FinancialRecord` que permite vincular un ingreso a un activo o un gasto a un pasivo. Usado para trazabilidad entre el Estado de Resultados y el Balance.

### AuditLog / Movement
En el código, estas dos palabras refieren a lo mismo: el registro de auditoría de creación/edición/eliminación de un `FinancialRecord`. La tabla en la DB se llama `movements`, el modelo Prisma se llama `AuditLog`, y el tipo TypeScript se llama `Movement`.

### AssetFinancialMovement / FinancialMovement
En el código, estas dos palabras refieren a lo mismo: una operación financiera sobre un activo (compra, venta, dividendo, etc.). La tabla en la DB se llama `financial_movements`, el modelo Prisma se llama `FinancialMovement`, y el tipo TypeScript se llama `AssetFinancialMovement`.
