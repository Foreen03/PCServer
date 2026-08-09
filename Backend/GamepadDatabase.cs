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

            var insertCommand = connection.CreateCommand();
            insertCommand.CommandText = @"
                INSERT OR IGNORE INTO gamepads (id, name, description, orientation, version, json_data, created_at, updated_at)
                VALUES ($id, $name, $description, $orientation, 1, $json_data, datetime('now'), datetime('now'));
            ";
            insertCommand.Parameters.AddWithValue("$id", "stk_motion_final");
            insertCommand.Parameters.AddWithValue("$name", "SuperTuxKart");
            insertCommand.Parameters.AddWithValue("$description", "Tilt to steer, step to accelerate (final version)");
            insertCommand.Parameters.AddWithValue("$orientation", "landscape");
            insertCommand.Parameters.AddWithValue("$json_data", """
{
  "version": 2,
  "gamepad": {
    "id": "stk_motion_final",
    "name": "SuperTuxKart",
    "description": "Tilt to steer, step to accelerate (final version)",
    "orientation": "landscape"
  },
  "theme": {
    "backgroundColor": "#CAE7D3",
    "backgroundImage": {
      "enabled": true,
      "type": "url",
      "value": "https://i.postimg.cc/65MnP8Fj/plufow-le-studio-5Q6y-ZN8cku-Y-unsplash.jpg",
      "scaleType": "fill"
    },
    "button": {
      "backgroundColor": "#6750A4",
      "pressedAlpha": 0.6,
      "textColor": "#FFFFFF",
      "textSizeSp": 20
    }
  },
  "layout": {
    "safeArea": {
      "top": 0.05,
      "bottom": 0.05,
      "left": 0.04,
      "right": 0.04
    },
    "components": [
      {
        "type": "button",
        "id": "btn_brake",
        "position": {
          "x": 0.8112880179628496,
          "y": 0.9057110545660165
        },
        "size": {
          "width": 0.39906103286384975,
          "height": 0.2035623409669211
        },
        "shape": "rectangle",
        "command": "brake",
        "content": {
          "type": "image",
          "image": {
            "type": "url",
            "value": "data:image/jpeg;base64,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",
            "scaleType": "fill"
          }
        },
        "style": {
          "showBackground": true
        }
      },
      {
        "type": "button",
        "id": "btn_lookback",
        "position": {
          "x": 0.7985303123086345,
          "y": 0.08580718122702856
        },
        "size": {
          "width": 0.4225352112676056,
          "height": 0.15267175572519084
        },
        "shape": "rectangle",
        "command": "look_back",
        "content": {
          "type": "image",
          "image": {
            "type": "url",
            "value": "data:image/jpeg;base64,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",
            "scaleType": "fill"
          }
        },
        "style": {
          "showBackground": true
        }
      }
    ],
    "systemComponents": [
      {
        "type": "pause",
        "id": "pause_button",
        "position": {
          "x": 0.5178607879159013,
          "y": 0.05753463387051173
        },
        "size": {
          "width": 0.09389671361502347,
          "height": 0.2035623409669211
        },
        "shape": "circle",
        "style": {
          "backgroundColor": "#6750A4",
          "textColor": "#FFFFFF"
        }
      },
      {
        "type": "screenshot",
        "id": "screenshot_button",
        "position": {
          "x": 0.5306184935701166,
          "y": 0.8774385072094997
        },
        "size": {
          "width": 0.11737089201877934,
          "height": 0.2544529262086514
        },
        "shape": "circle",
        "style": {
          "backgroundColor": "#FF9800",
          "textColor": "#FFFFFF"
        }
      },
      {
        "type": "toggle_system_bar",
        "id": "toggle_system_bar",
        "position": {
          "x": 0.020310267401510516,
          "y": 0.029262086513994905
        },
        "size": {
          "width": 0.07042253521126761,
          "height": 0.15267175572519084
        },
        "shape": "circle",
        "style": {
          "backgroundColor": "#2196F3",
          "textColor": "#FFFFFF"
        }
      }
    ]
  },
  "conflictsResolution": [],
  "controllerMapping": {
    "enabled": true,
    "buttonMap": {
      "fire": "B",
      "nitro": "LeftShoulder",
      "drift": "RightShoulder",
      "brake": "X",
      "menu": "Start",
      "look_back": "A"
    },
    "axisMap": {
      "steer": {
        "target": "LeftStickX",
        "mode": "tilt",
        "source": "x",
        "deadzone": 0.1,
        "scale": 1,
        "smoothing": 0.25,
        "invert": false
      }
    },
    "sensorMap": {
      "stepsCadence": {
        "target": "Y",
        "mode": "toggle",
        "thresholds": {
          "start": 40,
          "stop": 20
        }
      }
    }
  }
}
""");
            insertCommand.ExecuteNonQuery();
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
