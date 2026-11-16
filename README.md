# 🏢 ResiFlow — Sistema Inteligente de Gestión Residencial (v4.6.0)

![Expo](https://img.shields.io/badge/Expo-SDK_54-000020?style=for-the-badge&logo=expo&logoColor=white)
![React Native](https://img.shields.io/badge/React_Native-Multiplataforma-61DAFB?style=for-the-badge&logo=react&logoColor=black)
![TypeScript](https://img.shields.io/badge/TypeScript-5.x-3178C6?style=for-the-badge&logo=typescript&logoColor=white)
![Spring Boot](https://img.shields.io/badge/Backend-Spring_Boot_3-6DB33F?style=for-the-badge&logo=springboot&logoColor=white)
![PostgreSQL](https://img.shields.io/badge/Supabase-PostgreSQL-3ECF8E?style=for-the-badge&logo=supabase&logoColor=white)

**ResiFlow** es una plataforma SaaS **multi-residencial y multiplataforma (Web, Android e iOS)** desarrollada por **JR Technology S.R.L.** para digitalizar y automatizar la administración contable, el control de consumo de Gas GLP, la gestión de propietarios y el control de acceso mediante **Códigos QR inteligentes** para áreas comunes y apartamentos en **Airbnb**.

---

## ✨ Características Principales por Rol

### 🛡️ 1. Panel de Administración (`/(admin)`)
* **Contabilidad y Facturación Mensual (`FacturacionScreen`):**
   * Emisión y actualización de cuotas mensuales con desglose de conceptos (Agua, Luz, Mantenimiento y Otros).
   * Cálculo automático de balances históricos en vivo por unidad.
   * Carga de hasta **4 facturas o soportes fotográficos** por periodo contable.
   * Exportación instantánea de informes financieros en **PDF certificado** (con anexos fotográficos) y en **Imagen JPG de alta resolución** mediante renderizado en Canvas.
* **Control de Gas Común GLP en $m^3$:**
   * Registro de lectura anterior (`ANT`) y lectura actual (`ACT`) por apartamento con cálculo automático de consumo ($m^3$) y monto total en `RD$`.
   * Envío individual de recibos de cobro de gas con un solo toque.
* **Validación Financiera y Vouchers (`FinanzasScreen`):**
   * Bandeja de revisión de comprobantes (`PENDIENTE_VALIDACION`, `APROBADO`, `RECHAZADO`) con inyección automática al balance del propietario al aprobar.
   * Registro de pagos manuales en efectivo o transferencia.
   * **Paginación optimizada** y carga diferida (*lazy loading*) de comprobantes en visor de pantalla completa (*Lightbox*).
* **Directorio Dinámico de Propietarios (`PropietariosScreen`):**
   * Detección y filtrado dinámico de **Torres o Bloques** directamente desde la configuración de la base de datos (ej. `Torre A & B` o `Bloque A, B, C, D, E, F`).
   * Creación sincronizada de ficha de unidad + credenciales de usuario (`@username`).
   * Integración directa con **WhatsApp (`wa.me`)** con limpieza automática de formato telefónico.
* **Escáner / Validador de Puerta QR:**
   * Simulador y validador en tiempo real conectado al backend para verificar la autenticidad y vigencia horaria de cualquier pase QR en garita o puerta.

---

### 🏠 2. Portal de Propietarios (`/(propietario)`)
* **Estado de Cuenta y Pagos (`mis-pagos`):**
   * Consulta de solvencia en tiempo real (`Al Corriente` / `En Mora`), historial de cuotas y subida de comprobantes de pago desde la cámara o galería.
* **Reservas de Áreas Comunes con QR (`reservas`):**
   * Selección de áreas sociales (Gazebo Principal, Piscina & BBQ, Salón Multiusos, Terraza Rooftop).
   * Calendario y selector de horas inteligente conectado a la base de datos que **bloquea automáticamente los horarios ya reservados** por otros vecinos.
* **Llaves Digitales QR Temporales para Airbnb / Huéspedes:**
   * Generación de pases criptográficos únicos (`RF-AIRBNB-...`) vinculados a nombre, pasaporte/cédula y ventana estricta de **Check-In** y **Check-Out**.
   * Descarga y envío del ticket digital en **PDF por WhatsApp** listo para ser leído por lectores ópticos en puerta.
* **Avisos y Reporte de Averías (`avisos-reportes`):**
   * Canal directo para reportar incidencias de mantenimiento y recibir comunicados oficiales de la junta.

---

### 🌐 3. Panel Master Empresa (`/(empresa)` — Exclusivo Web) (PROXIMAMENTE)
* Administración centralizada multi-condominio (`idResidencial`).
* Alta y monitoreo de residenciales activos, configuración de bloques/torres, cantidad de unidades y estado operativo.

---

## 🧠 Módulos Transversales

| Módulo | Descripción |
| :--- | :--- |
| **`ResiAssistantWidget`** | Asistente virtual flotante contextualizado según el rol activo (`ADMIN` o `PROPIETARIO`). |
| **`ResiAlert` & `ResiAlertOverlay`** | Sistema propio de modales de confirmación, alertas tipificadas y notificaciones *Toast* multiplataforma. |
| **`useAppTheme` & `PreferencesStore`** | Soporte nativo para **Modo Claro / Modo Oscuro** con persistencia en `AsyncStorage` y `localStorage`. |
| **Notificaciones Push** | Integración con `expo-notifications` y suscripción por tópicos (`admin_residencial_X`, `usuario_X`). |
| **Integración IoT / Hardware QR** | Endpoint `/api/accesos-qr/validar` preparado para lectores ópticos IP (ZKTeco, Hikvision) o controladores **ESP32 + GM65** para apertura de relés/electroimanes. |

---

## 🛠️ Stack Tecnológico

* **Frontend Móvil & Web:** React Native, Expo (SDK 54), Expo Router (File-based routing), TypeScript.
* **Librerías Clave:** `expo-print`, `expo-sharing`, `expo-image-picker`, `expo-notifications`, `react-native-safe-area-context`, `@react-native-async-storage/async-storage`, `@expo/vector-icons`.
* **Backend API:** Java + Spring Boot.
* **Base de Datos:** PostgreSQL en **Supabase** (Esquema multi-tenant por `id_residencial`).

---

## 📂 Estructura Principal del Proyecto

```text
├── app/
│   ├── (auth)/
│   │   └── login.tsx            # Login, SessionStore, PreferencesStore y ResiAlertOverlay
│   ├── (admin)/
│   │   ├── _layout.tsx          # Layout responsivo Admin (Sidebar Web / BottomNav Móvil)
│   │   ├── dashboard.tsx        # Resumen ejecutivo y métricas del residencial
│   │   ├── facturacion.tsx      # Contabilidad mensual, PDF/IMG y Control de Gas GLP (m³)
│   │   ├── finanzas.tsx         # Validación paginada de vouchers y pagos manuales
│   │   ├── propietarios.tsx     # Directorio dinámico por Torres/Bloques y WhatsApp
│   │   ├── reportes.tsx         # Gestión de averías y comunicados
│   │   ├── reservas.tsx         # Control de reservas, pases Airbnb y validador de puerta
│   │   └── settings.tsx         # Ajustes del administrador y preferencias
│   ├── (propietario)/
│   │   ├── _layout.tsx          # Layout Propietario con campana de notificaciones en vivo
│   │   ├── index.tsx            # Resumen de unidad y accesos rápidos
│   │   ├── mis-pagos.tsx        # Subida de vouchers e historial de pagos
│   │   ├── avisos-reportes.tsx  # Avisos de la junta y reporte de averías
│   │   ├── reservas.tsx         # Reservas de áreas comunes y llaves QR para Airbnb
│   │   └── settings.tsx         # Ajustes de cuenta y tema visual
│   ├── (empresa)/
│   │   └── dashboard.tsx        # Panel Master SaaS multi-residencial (Web)
│   └── components/
│       └── ResiAssistantWidget.tsx # Asistente IA integrado
├── assets/
│   └── images/                  # Logos e iconos adaptativos de ResiFlow
└── hooks/
    └── useAppTheme.ts           # Hook de paleta dinámica (Light / Dark Mode)
```

## 👨‍💻 Autor

Desarrollado por **Juan Rijo**  
Version **5.6.0**
**JR Technology S.R.L.** — Ingeniería en Ciencias de la Computación (PUCMM)