using System;
using System.Collections.Generic;
using System.IO;
using System.Text.Json;
using Microsoft.Data.Sqlite;

namespace Backend
{
    public class GamepadSummary
    {
        public string Id { get; set; } = "";
        public string Name { get; set; } = "";
        public string Description { get; set; } = "";
        public string Orientation { get; set; } = "landscape";
        public int Version { get; set; } = 1;
        public string CreatedAt { get; set; } = "";
        public string UpdatedAt { get; set; } = "";
    }

    public static class GamepadDatabase
    {
        private static string _connectionString = "";

        public static void Initialize()
        {
            var dbPath = Path.Combine(AppContext.BaseDirectory, "gamepads.db");
            _connectionString = $"Data Source={dbPath}";

            using var connection = new SqliteConnection(_connectionString);
            connection.Open();

            var command = connection.CreateCommand();
            command.CommandText = @"
                CREATE TABLE IF NOT EXISTS gamepads (
                    id          TEXT PRIMARY KEY,
                    name        TEXT NOT NULL,
                    description TEXT DEFAULT '',
                    orientation TEXT DEFAULT 'landscape',
                    version     INTEGER DEFAULT 1,
                    json_data   TEXT NOT NULL,
                    created_at  TEXT DEFAULT (datetime('now')),
                    updated_at  TEXT DEFAULT (datetime('now'))
                );
            ";
            command.ExecuteNonQuery();
        }

        public static void SaveGamepad(string id, string name, string description, string orientation, string jsonData)
        {
            using var connection = new SqliteConnection(_connectionString);
            connection.Open();

            var command = connection.CreateCommand();
            command.CommandText = @"
                INSERT INTO gamepads (id, name, description, orientation, version, json_data, created_at, updated_at)
                VALUES ($id, $name, $description, $orientation, 1, $json_data, datetime('now'), datetime('now'))
                ON CONFLICT(id) DO UPDATE SET
                    name = $name,
                    description = $description,
                    orientation = $orientation,
                    version = version + 1,
                    json_data = $json_data,
                    updated_at = datetime('now');
            ";
            command.Parameters.AddWithValue("$id", id);
            command.Parameters.AddWithValue("$name", name);
            command.Parameters.AddWithValue("$description", description);
            command.Parameters.AddWithValue("$orientation", orientation);
            command.Parameters.AddWithValue("$json_data", jsonData);
            command.ExecuteNonQuery();
        }

        public static List<GamepadSummary> GetAllGamepads()
        {
            var gamepads = new List<GamepadSummary>();

            using var connection = new SqliteConnection(_connectionString);
            connection.Open();

            var command = connection.CreateCommand();
            command.CommandText = @"
                SELECT id, name, description, orientation, version, created_at, updated_at
                FROM gamepads
                ORDER BY updated_at DESC;
            ";

            using var reader = command.ExecuteReader();
            while (reader.Read())
            {
                gamepads.Add(new GamepadSummary
                {
                    Id = reader.GetString(0),
                    Name = reader.GetString(1),
                    Description = reader.IsDBNull(2) ? "" : reader.GetString(2),
                    Orientation = reader.IsDBNull(3) ? "landscape" : reader.GetString(3),
                    Version = reader.IsDBNull(4) ? 1 : reader.GetInt32(4),
                    CreatedAt = reader.IsDBNull(5) ? "" : reader.GetString(5),
                    UpdatedAt = reader.IsDBNull(6) ? "" : reader.GetString(6),
                });
            }

            return gamepads;
        }

        public static string? GetGamepad(string id)
        {
            using var connection = new SqliteConnection(_connectionString);
            connection.Open();

            var command = connection.CreateCommand();
            command.CommandText = "SELECT json_data FROM gamepads WHERE id = $id;";
            command.Parameters.AddWithValue("$id", id);

            return command.ExecuteScalar() as string;
        }

        public static bool DeleteGamepad(string id)
        {
            using var connection = new SqliteConnection(_connectionString);
            connection.Open();

            var command = connection.CreateCommand();
            command.CommandText = "DELETE FROM gamepads WHERE id = $id;";
            command.Parameters.AddWithValue("$id", id);

            return command.ExecuteNonQuery() > 0;
        }

        public static List<GamepadSummary> GetGamepadsWithControllerMapping()
        {
            var gamepads = new List<GamepadSummary>();

            using var connection = new SqliteConnection(_connectionString);
            connection.Open();

            var command = connection.CreateCommand();
            command.CommandText = @"
                SELECT id, name, description, orientation, version, created_at, updated_at
                FROM gamepads
                WHERE json_extract(json_data, '$.controllerMapping.enabled') = 1
                ORDER BY updated_at DESC;
            ";

            using var reader = command.ExecuteReader();
            while (reader.Read())
            {
                gamepads.Add(new GamepadSummary
                {
                    Id = reader.GetString(0),
                    Name = reader.GetString(1),
                    Description = reader.IsDBNull(2) ? "" : reader.GetString(2),
                    Orientation = reader.IsDBNull(3) ? "landscape" : reader.GetString(3),
                    Version = reader.IsDBNull(4) ? 1 : reader.GetInt32(4),
                    CreatedAt = reader.IsDBNull(5) ? "" : reader.GetString(5),
                    UpdatedAt = reader.IsDBNull(6) ? "" : reader.GetString(6),
                });
            }

            return gamepads;
        }
    }
}
