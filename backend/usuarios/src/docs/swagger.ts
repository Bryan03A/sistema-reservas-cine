export const swaggerDocument = {
  openapi: "3.0.3",

  info: {
    title: "Sistema de Reservas de Cine - API de Usuarios",
    version: "1.0.0",
    description:
      "API de autenticación, gestión de usuarios, clientes y auditoría."
  },

  servers: [
    {
      url: "http://localhost:3000",
      description: "Servidor local de desarrollo"
    }
  ],

  components: {
    securitySchemes: {
      bearerAuth: {
        type: "http",
        scheme: "bearer",
        bearerFormat: "JWT"
      }
    }
  },

  paths: {
    "/health": {
      get: {
        summary: "Verificar el estado de la API",
        responses: {
          "200": {
            description: "La API está funcionando."
          }
        }
      }
    },

    "/clientes/me": {
      get: {
        summary: "Consultar el perfil del cliente autenticado",
        security: [{ bearerAuth: [] }],
        responses: {
          "200": {
            description: "Perfil consultado correctamente."
          },
          "401": {
            description: "Token inválido o ausente."
          },
          "404": {
            description: "Perfil de cliente no encontrado."
          }
        }
      },

      put: {
        summary: "Actualizar el perfil del cliente autenticado",
        security: [{ bearerAuth: [] }],
        responses: {
          "200": {
            description: "Perfil actualizado correctamente."
          },
          "400": {
            description: "Datos inválidos o campos no permitidos."
          },
          "401": {
            description: "Token inválido o ausente."
          },
          "404": {
            description: "Perfil de cliente no encontrado."
          }
        }
      }
    },

    "/clientes": {
      get: {
        summary: "Listar clientes",
        security: [{ bearerAuth: [] }],
        responses: {
          "200": {
            description: "Lista de clientes."
          },
          "401": {
            description: "Token inválido o ausente."
          },
          "403": {
            description: "Permisos insuficientes."
          }
        }
      }
    },

    "/usuarios": {
      get: {
        summary: "Listar usuarios",
        security: [{ bearerAuth: [] }],
        responses: {
          "200": {
            description: "Lista de usuarios."
          },
          "401": {
            description: "Token inválido o ausente."
          },
          "403": {
            description: "Permisos insuficientes."
          }
        }
      },

      post: {
        summary: "Crear usuario",
        security: [{ bearerAuth: [] }],
        responses: {
          "201": {
            description: "Usuario creado."
          },
          "400": {
            description: "Datos inválidos."
          },
          "401": {
            description: "Token inválido o ausente."
          },
          "403": {
            description: "Permisos insuficientes."
          },
          "409": {
            description: "El usuario ya existe."
          }
        }
      }
    },

    "/auditoria": {
      get: {
        summary: "Consultar los registros de auditoría",
        security: [{ bearerAuth: [] }],
        responses: {
          "200": {
            description: "Registros consultados."
          },
          "401": {
            description: "Token inválido o ausente."
          },
          "403": {
            description: "Permisos insuficientes."
          }
        }
      }
    }
  }
};