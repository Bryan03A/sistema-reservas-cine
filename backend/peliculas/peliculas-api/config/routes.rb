Rails.application.routes.draw do
  get "up" => "rails/health#show", as: :rails_health_check

  get "/peliculas", to: "peliculas#index"
  get "/peliculas/:id", to: "peliculas#show"
  get "/api/protegido", to: "api/protegido#show"

  # API administrativa de películas.
  get "/api/peliculas",
      to: "api/peliculas#index"

  get "/api/peliculas/:id",
      to: "api/peliculas#show"

  post "/api/peliculas",
       to: "api/peliculas#create"

  put "/api/peliculas/:id",
      to: "api/peliculas#update"

  patch "/api/peliculas/:id/estado",
        to: "api/peliculas#cambiar_estado"

  get "/api/funciones",
    to: "api/funciones#index"

  get "/api/funciones/:id",
      to: "api/funciones#show"

  post "/api/funciones",
      to: "api/funciones#create"

  put "/api/funciones/:id",
      to: "api/funciones#update"

  patch "/api/funciones/:id/cancelar",
      to: "api/funciones#cancelar"

  get "/api/funciones/:id/estructura",
      to: "api/estructuras#show"

  get "/internal/funciones/detalle",
      to: "internal/funciones#detalle"

  get "/api/salas",
      to: "api/salas#index"

  patch "/api/asientos/:id/estado",
      to: "api/asientos#cambiar_estado"

end
