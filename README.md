# Sistema de Gestión de Reservas de Películas

## 1. Descripción del proyecto

Sistema web para la gestión integral de reservas de boletos de cine, desarrollado mediante una arquitectura de microservicios. La aplicación permite gestionar usuarios, películas, funciones, salas, secciones, filas, asientos y reservas, así como generar boletos electrónicos con códigos QR.

El sistema contempla distintos niveles de acceso según los roles de usuario y proporciona herramientas de consulta y generación de reportes para clientes y administradores.

## 2. Objetivo

Desarrollar un sistema de gestión de reservas de películas que automatice el proceso de consulta de funciones, selección de asientos, creación y administración de reservas, emisión de boletos electrónicos con códigos QR y generación de reportes.

## 3. Alcance

El proyecto contempla:

- Registro e inicio de sesión de usuarios.
- Autenticación mediante JWT y autorización basada en roles.
- Gestión de películas, funciones y salas.
- Administración de secciones, filas y asientos.
- Selección y control de disponibilidad de asientos.
- Reservas de hasta seis boletos por compra.
- Expiración de reservas pendientes después de cinco minutos y liberación de asientos.
- Generación de boletos electrónicos con códigos QR.
- Consulta del historial de reservas por cliente.
- Generación de reportes administrativos por rango de fechas.
- Comunicación entre microservicios mediante APIs REST.

Los procesos de pago, facturación y pasarelas de pago están fuera del alcance del proyecto.

## 4. Arquitectura del sistema

El sistema se organiza en tres microservicios principales:

### Microservicio de Usuarios y Autenticación
Responsable del registro de usuarios, inicio de sesión, gestión de roles, validación de credenciales y control de acceso.

### Microservicio de Películas
Responsable de la administración de películas, funciones, salas, secciones, filas y asientos.

### Microservicio de Reservas
Responsable de gestionar las reservas, controlar la disponibilidad de asientos, aplicar las reglas de negocio, generar boletos electrónicos con códigos QR y proporcionar reportes.

El frontend consume las APIs REST para ofrecer las funcionalidades correspondientes a cada rol.

## 5. Tecnologías utilizadas

Las tecnologías definitivas deben corresponder a las implementadas en el código del proyecto.

- **Backend:** [Indicar tecnologías y frameworks utilizados en cada microservicio].
- **Frontend:** [Indicar framework o biblioteca utilizada].
- **Bases de datos:** PostgreSQL.
- **ORM:** [Indicar el ORM utilizado en cada servicio].
- **Autenticación:** JWT y OAuth 2.0, según la implementación.
- **Documentación de APIs:** OpenAPI / Swagger.
- **Control de versiones:** Git y GitHub.

## 6. Modelo de datos

El modelo entidad-relación representa las entidades principales del negocio y sus relaciones, incluyendo usuarios, roles, clientes, películas, funciones, salas, secciones, filas, asientos, reservas y boletos.

Cada microservicio administra los datos correspondientes a su dominio funcional, manteniendo la integridad y consistencia de la información.

## 7. Seguridad

El sistema contempla:

- Autenticación de usuarios.
- Autorización basada en roles.
- Uso de tokens de acceso JWT.
- Validación y sanitización de entradas.
- Almacenamiento seguro de contraseñas mediante mecanismos de hash apropiados.
- Protección de variables de entorno y credenciales.
- Principios de confidencialidad, integridad y disponibilidad.
- Autenticación, autorización y auditoría.

La aplicación de OAuth 2.0 y las prácticas DevSecOps se documentará de acuerdo con su implementación efectiva.

## 8. Instalación y ejecución

1. Clonar el repositorio.
2. Instalar las dependencias de cada microservicio y del frontend.
3. Configurar las variables de entorno a partir de los archivos `.env.example`.
4. Crear y configurar las bases de datos requeridas.
5. Ejecutar las migraciones o scripts de creación de tablas.
6. Cargar los datos iniciales mediante los archivos semilla.
7. Iniciar los microservicios.
8. Iniciar el frontend y verificar la comunicación con las APIs.

Los comandos específicos de instalación y ejecución se documentarán según las tecnologías de cada componente.

## 9. Documentación de las APIs

Cada microservicio debe disponer de documentación OpenAPI o Swagger con sus endpoints, parámetros, modelos de datos, mecanismos de autenticación y respuestas.

## 10. Reglas de negocio

- Máximo de seis boletos por reserva.
- Una reserva corresponde a una única función.
- Cada asiento debe tener un estado de disponibilidad controlado.
- Las reservas pendientes expiran después de cinco minutos, según las reglas definidas.
- Cada boleto debe disponer de un código QR único.
- Los usuarios solo pueden acceder a las funcionalidades autorizadas para su rol.

## 11. Entregables académicos

- Modelo entidad-relación.
- Scripts SQL de creación y población de tablas.
- Microservicios backend.
- Aplicación web frontend.
- Documentación de APIs.
- Diagramas de arquitectura.
- Instrucciones de configuración y despliegue.

## 12. Contexto académico

**Institución:** Universidad Central del Ecuador  
**Facultad:** Ingeniería y Ciencias Aplicadas  
**Carrera:** Ingeniería en Sistemas de Información  
**Componente:** Ingeniería de Software  
**Subcomponente:** Análisis, Diseño y Desarrollo de Sistemas de Información  
**Tema específico:** Sistemas de Gestión  
**Caso:** 3 — Sistema de Gestión de Reservas de Películas
