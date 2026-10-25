ENV["BUNDLE_GEMFILE"] ||= File.expand_path("../Gemfile", __dir__)

require "bundler/setup"

require "dotenv"

env_path = File.expand_path("../../../../.env", __dir__)

unless File.exist?(env_path)
  abort "No se encontró el archivo .env en: #{env_path}"
end

Dotenv.load(env_path)

require "bootsnap/setup"
