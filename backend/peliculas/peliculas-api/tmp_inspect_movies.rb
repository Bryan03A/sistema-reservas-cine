require "json"

%w[pelicula funcion sala].each do |table|
  next unless ActiveRecord::Base.connection.data_source_exists?(table)

  columns = ActiveRecord::Base.connection.columns(table).map do |column|
    {
      name: column.name,
      type: column.type,
      null: column.null
    }
  end

  puts "\nTabla: #{table}"
  puts JSON.pretty_generate(columns)
end
