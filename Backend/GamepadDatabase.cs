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
          "showBackground": true,
          "backgroundColor": "#494554"
        }
      },
      {
        "type": "button",
        "id": "btn_drift",
        "position": {
          "x": 0.2244335578689529,
          "y": 0.22716991800961267
        },
        "size": {
          "width": 0.4460093896713615,
          "height": 0.4071246819338422
        },
        "shape": "rectangle",
        "command": "drift",
        "content": {
          "type": "image",
          "image": {
            "type": "url",
            "value": "https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcRDtKrRI5nXV8pldl6OVOOXuZIo7MWjUsi2Iw&s",
            "scaleType": "fill"
          }
        },
        "style": {
          "showBackground": true
        }
      },
      {
        "type": "button",
        "id": "btn_nitro",
        "position": {
          "x": 0.2244335578689529,
          "y": 0.7643483177834324
        },
        "size": {
          "width": 0.4460093896713615,
          "height": 0.4580152671755725
        },
        "shape": "rectangle",
        "command": "nitro",
        "content": {
          "type": "image",
          "image": {
            "type": "url",
            "value": "https://i.ytimg.com/vi/h6j8ogLOVNE/maxresdefault.jpg",
            "scaleType": "fill"
          }
        },
        "style": {
          "showBackground": true
        }
      },
      {
        "type": "button",
        "id": "btn_item",
        "position": {
          "x": 0.7985303123086345,
          "y": 0.48162284421826407
        },
        "size": {
          "width": 0.4225352112676056,
          "height": 0.4580152671755725
        },
        "shape": "rectangle",
        "command": "fire",
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

            var insertCommand2 = connection.CreateCommand();
            insertCommand2.CommandText = @"
                INSERT OR IGNORE INTO gamepads (id, name, description, orientation, version, json_data, created_at, updated_at)
                VALUES ($id, $name, $description, $orientation, 1, $json_data, datetime('now'), datetime('now'));
            ";
            insertCommand2.Parameters.AddWithValue("$id", "stk_standard_buttons");
            insertCommand2.Parameters.AddWithValue("$name", "Standard Controller");
            insertCommand2.Parameters.AddWithValue("$description", "Standard Xbox-style button layout: A/B/X/Y, D-pad, LB/RB, Start/Back, L3/R3 (buttons only, same format as the SuperTuxKart layout)");
            insertCommand2.Parameters.AddWithValue("$orientation", "landscape");
            insertCommand2.Parameters.AddWithValue("$json_data", """
{
  "version": 2,
  "gamepad": {
    "id": "stk_standard_buttons",
    "name": "Standard Controller",
    "description": "Standard Xbox-style button layout: A/B/X/Y, D-pad, LB/RB, Start/Back, L3/R3 (buttons only, same format as the SuperTuxKart layout)",
    "orientation": "landscape"
  },
  "theme": {
    "backgroundColor": "#1B1B1F",
    "backgroundImage": {
      "enabled": false,
      "type": "url",
      "value": "",
      "scaleType": "fill"
    },
    "button": {
      "backgroundColor": "#4A4458",
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
        "id": "btn_face_y",
        "position": {
          "x": 0.849561134925495,
          "y": 0.34026010743567997
        },
        "size": {
          "width": 0.10206164523372117,
          "height": 0.22618037885213457
        },
        "shape": "circle",
        "command": "face_y",
        "content": {
          "type": "image",
          "image": {
            "type": "url",
            "value": "data:image/jpeg;base64,/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDAAUDBAQEAwUEBAQFBQUGBwwIBwcHBw8LCwkMEQ8SEhEPERETFhwXExQaFRERGCEYGh0dHx8fExciJCIeJBweHx7/2wBDAQUFBQcGBw4ICA4eFBEUHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh7/wAARCACgAKADASIAAhEBAxEB/8QAHwAAAQUBAQEBAQEAAAAAAAAAAAECAwQFBgcICQoL/8QAtRAAAgEDAwIEAwUFBAQAAAF9AQIDAAQRBRIhMUEGE1FhByJxFDKBkaEII0KxwRVS0fAkM2JyggkKFhcYGRolJicoKSo0NTY3ODk6Q0RFRkdISUpTVFVWV1hZWmNkZWZnaGlqc3R1dnd4eXqDhIWGh4iJipKTlJWWl5iZmqKjpKWmp6ipqrKztLW2t7i5usLDxMXGx8jJytLT1NXW19jZ2uHi4+Tl5ufo6erx8vP09fb3+Pn6/8QAHwEAAwEBAQEBAQEBAQAAAAAAAAECAwQFBgcICQoL/8QAtREAAgECBAQDBAcFBAQAAQJ3AAECAxEEBSExBhJBUQdhcRMiMoEIFEKRobHBCSMzUvAVYnLRChYkNOEl8RcYGRomJygpKjU2Nzg5OkNERUZHSElKU1RVVldYWVpjZGVmZ2hpanN0dXZ3eHl6goOEhYaHiImKkpOUlZaXmJmaoqOkpaanqKmqsrO0tba3uLm6wsPExcbHyMnK0tPU1dbX2Nna4uPk5ebn6Onq8vP09fb3+Pn6/9oADAMBAAIRAxEAPwC3RRRX4efcBRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAd98LPC3hnxWlxaahd6hBqMPzhIpUCyR+oBQnIPXnuK7r/AIU34Y/5/wDWP+/0f/xuvFdB1S70XV7bU7F9k8D7h6MO6n2IyD9a+oPDOs2mv6JbarZt+7mXlSeUbup9wa+24dp4DG0nSq01zx/Fd/l1PEzGVejLmhJ8r/A8R+Kfw/j8LQW9/pctzcWLny5TMQzRv25AAwfp1HuK8/r621fT7XVdMuNOvY/Mt7hCjr7eo9x1HvXy/wCLNDuvDuvXOlXQyYmzG+MCRD91h9R+uRXBxHlEcHUVairQl+D/AOD/AJm+W4x1o8k37yMmvQvhZ8Po/FFtcahqktzb2Kny4TCQrSP3OWB4HTp1PtXKeENCuvEev2+lWuR5hzLJjiNB95j/AJ64FfUGlWFrpem2+n2UYjt7dAiL7D19+5NHDeTxxlR1qyvCP4v/AIAZljHRjyQfvM4D/hTfhj/n/wBY/wC/0f8A8brhPin4W8NeFFt7TTrvULjUZvnZZpUKxx+pAQHJPTnsa9w8Ua1aeH9DudVvD8kK/KgPMjHoo9ya+X9c1O71nVrnU75989w5ZvQegHsBgD6V38R08BgqapUqa55fgu/z6fMwy6VetLnnJ8q/EpUUUV8Se2FFFFABRRRQAUUUUAFFFFABRRRQAV3vwc8W/wBga3/Z97Lt06+YKxJ4ik6K/sOx/A9q4KiunCYqphK0a1Pdf1YzrUo1YOEtmfYFcL8YfCf/AAkOg/bbSLdqNipeMAcyJ1ZPr3Hvx3qt8FvFv9taP/ZF7LnULFAFLHmWLoD9RwD+B716HX6qnQzbB/3ZL7n/AJpnyjVTCVvNHEfCDwn/AMI7oAuruPGo3oDy5HMafwp/U+59q7eivO/jX4t/sbSP7GsZcX96hDlTzFF0J+p5A/H2olKhlOD/ALsV97/zbBKpi63mzz74xeLf+Eh1z7DZy7tNsmKoQeJZOjP7jsPbJ71wlFFflWLxVTF1pVqm7Pq6NKNKChHZBRRRXMaBRRRQAUUUUAFFFFABRRRQAUUUUAFFFFAF/wAP6td6HrFtqlk+2aB9wHZh3U+xGRX1ZZzC4tIbgLtEsavjOcZGa+RK+tdG/wCQPZf9e8f/AKCK+44OqS/ewvpo/wAzw85ivcl11Jb2f7NZT3JXd5UbPtzjOBnFfKev6rd63q9zql8+6ed9x9FHZR7AYFfU2uf8gS+/69pP/QTXyXS4xqSvShfTV/kGTRXvy66BRRRXxB7gUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFfWujf8gey/694//QRXyVXuOn/F/wANW9hbwPY6uWjiVCRFHjIAH9+vq+FsbQwsqjrSUb2tf5nlZpQqVVHkV9z0PXP+QJff9e0n/oJr5Lr3HUvi94audOubdLHVg8sTopaKPGSCOfnrw6jijG0MVOm6MlK19vkGV0alJS51bYKKKK+UPVCiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKAP/2Q==",
            "scaleType": "fill"
          }
        },
        "style": {
          "showBackground": true,
          "backgroundColor": "#B8860B"
        }
      },
      {
        "type": "button",
        "id": "btn_face_a",
        "position": {
          "x": 0.849561134925495,
          "y": 0.7926208651399492
        },
        "size": {
          "width": 0.10206164523372117,
          "height": 0.22618037885213457
        },
        "shape": "circle",
        "command": "face_a",
        "content": {
          "type": "image",
          "image": {
            "type": "url",
            "value": "data:image/jpeg;base64,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",
            "scaleType": "fill"
          }
        },
        "style": {
          "showBackground": true,
          "backgroundColor": "#3E8E41"
        }
      },
      {
        "type": "button",
        "id": "btn_face_x",
        "position": {
          "x": 0.7474994896917738,
          "y": 0.5664404862878145
        },
        "size": {
          "width": 0.10206164523372117,
          "height": 0.22618037885213457
        },
        "shape": "circle",
        "command": "face_x",
        "content": {
          "type": "image",
          "image": {
            "type": "url",
            "value": "data:image/jpeg;base64,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",
            "scaleType": "fill"
          }
        },
        "style": {
          "showBackground": true,
          "backgroundColor": "#1565C0"
        }
      },
      {
        "type": "button",
        "id": "btn_face_b",
        "position": {
          "x": 0.9516227801592162,
          "y": 0.5664404862878145
        },
        "size": {
          "width": 0.10206164523372117,
          "height": 0.22618037885213457
        },
        "shape": "circle",
        "command": "face_b",
        "content": {
          "type": "image",
          "image": {
            "type": "url",
            "value": "data:image/jpeg;base64,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",
            "scaleType": "fill"
          }
        },
        "style": {
          "showBackground": true,
          "backgroundColor": "#D32F2F"
        }
      },
      {
        "type": "button",
        "id": "btn_dpad_up",
        "position": {
          "x": 0.1989181465605226,
          "y": 0.34026010743567997
        },
        "size": {
          "width": 0.12757705654215148,
          "height": 0.22618037885213457
        },
        "shape": "rectangle",
        "command": "dpad_up",
        "content": {
          "type": "image",
          "image": {
            "type": "url",
            "value": "data:image/jpeg;base64,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",
            "scaleType": "fill"
          }
        },
        "style": {
          "showBackground": true,
          "backgroundColor": "#454050"
        }
      },
      {
        "type": "button",
        "id": "btn_dpad_down",
        "position": {
          "x": 0.1989181465605226,
          "y": 0.7926208651399492
        },
        "size": {
          "width": 0.12757705654215148,
          "height": 0.22618037885213457
        },
        "shape": "rectangle",
        "command": "dpad_down",
        "content": {
          "type": "image",
          "image": {
            "type": "url",
            "value": "data:image/jpeg;base64,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",
            "scaleType": "fill"
          }
        },
        "style": {
          "showBackground": true,
          "backgroundColor": "#454050"
        }
      },
      {
        "type": "button",
        "id": "btn_dpad_left",
        "position": {
          "x": 0.0713410900183711,
          "y": 0.5664404862878145
        },
        "size": {
          "width": 0.12757705654215148,
          "height": 0.22618037885213457
        },
        "shape": "rectangle",
        "command": "dpad_left",
        "content": {
          "type": "image",
          "image": {
            "type": "url",
            "value": "data:image/jpeg;base64,/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDAAUDBAQEAwUEBAQFBQUGBwwIBwcHBw8LCwkMEQ8SEhEPERETFhwXExQaFRERGCEYGh0dHx8fExciJCIeJBweHx7/2wBDAQUFBQcGBw4ICA4eFBEUHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh7/wAARCACgAKADASIAAhEBAxEB/8QAHwAAAQUBAQEBAQEAAAAAAAAAAAECAwQFBgcICQoL/8QAtRAAAgEDAwIEAwUFBAQAAAF9AQIDAAQRBRIhMUEGE1FhByJxFDKBkaEII0KxwRVS0fAkM2JyggkKFhcYGRolJicoKSo0NTY3ODk6Q0RFRkdISUpTVFVWV1hZWmNkZWZnaGlqc3R1dnd4eXqDhIWGh4iJipKTlJWWl5iZmqKjpKWmp6ipqrKztLW2t7i5usLDxMXGx8jJytLT1NXW19jZ2uHi4+Tl5ufo6erx8vP09fb3+Pn6/8QAHwEAAwEBAQEBAQEBAQAAAAAAAAECAwQFBgcICQoL/8QAtREAAgECBAQDBAcFBAQAAQJ3AAECAxEEBSExBhJBUQdhcRMiMoEIFEKRobHBCSMzUvAVYnLRChYkNOEl8RcYGRomJygpKjU2Nzg5OkNERUZHSElKU1RVVldYWVpjZGVmZ2hpanN0dXZ3eHl6goOEhYaHiImKkpOUlZaXmJmaoqOkpaanqKmqsrO0tba3uLm6wsPExcbHyMnK0tPU1dbX2Nna4uPk5ebn6Onq8vP09fb3+Pn6/9oADAMBAAIRAxEAPwDx2iiiusoKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAop8UcksixxIzuxwqqMkn0AplABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRSqrMwVVLMTgADJJr1Hwd8BviH4hWOeXTotHtXAIlv5NhI9kGX/MCk2luB5bUlvDNczpBbxSTSucIkalmY+gA619Y+EP2ZvC1hsm8R6pe6xKOTFF/o8P0OCXP1DCvXvDPhTw14Zg8nQNDsdOGMFoYQHb/eb7zfiTUOougrnxz4Q+BnxF8RbJDo40m2b/AJbai3k/+OYL/wDjtexeEP2Y/D1nsm8Tazd6pIOTDbDyIvoTyx+oK179RWbqNiuYPhXwZ4V8LRhNA0GxsCBgyRxAysPdzlj+Jr88n++frX6V1+aj/fP1q6XUaG0UUVqMKKKKACiiigAooooAKKKKACiiigArpfCXjzxh4UZf7B8Q31nGpz5G/fCf+2bZX9K5qigD6G8IftPavb7IfFOg218g4NxZOYpPqVOVY/QrXsXhD41fDvxJsjh11NOuW/5YaiPIbPpuPyE+wY18L0VDppisfpXG6SxrJG6ujDKspyCPUGnV+eXhXxp4r8LSBtA1++sFBz5SSZiJ94zlT+Ir2Dwh+054gtNkPibRbTU4xwZ7ZvIl+pHKk+wC1m6b6BY+ra/NR/vn619weEPjl8OvEWyP+2f7KuW/5Y6ivk/+P5Kf+PV8PN94/Wqppq9wQlFFFajCiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKAP/9k=",
            "scaleType": "fill"
          }
        },
        "style": {
          "showBackground": true,
          "backgroundColor": "#454050"
        }
      },
      {
        "type": "button",
        "id": "btn_dpad_right",
        "position": {
          "x": 0.32649520310267405,
          "y": 0.5664404862878145
        },
        "size": {
          "width": 0.12757705654215148,
          "height": 0.22618037885213457
        },
        "shape": "rectangle",
        "command": "dpad_right",
        "content": {
          "type": "image",
          "image": {
            "type": "url",
            "value": "data:image/jpeg;base64,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",
            "scaleType": "fill"
          }
        },
        "style": {
          "showBackground": true,
          "backgroundColor": "#454050"
        }
      },
      {
        "type": "button",
        "id": "btn_shoulder_left",
        "position": {
          "x": 0.1734027352520923,
          "y": 0.08580718122702856
        },
        "size": {
          "width": 0.17860787915901205,
          "height": 0.16963528413910095
        },
        "shape": "rectangle",
        "command": "shoulder_left",
        "content": {
          "type": "text",
          "text": "LB"
        },
        "style": {
          "showBackground": true,
          "backgroundColor": "#4A4458"
        }
      },
      {
        "type": "button",
        "id": "btn_shoulder_right",
        "position": {
          "x": 0.8623188405797102,
          "y": 0.08580718122702856
        },
        "size": {
          "width": 0.17860787915901205,
          "height": 0.16963528413910095
        },
        "shape": "rectangle",
        "command": "shoulder_right",
        "content": {
          "type": "text",
          "text": "RB"
        },
        "style": {
          "showBackground": true,
          "backgroundColor": "#4A4458"
        }
      },
      {
        "type": "button",
        "id": "btn_back",
        "position": {
          "x": 0.3647683200653195,
          "y": 0.08580718122702856
        },
        "size": {
          "width": 0.15309246785058175,
          "height": 0.16963528413910095
        },
        "shape": "rectangle",
        "command": "back",
        "content": {
          "type": "text",
          "text": "Back"
        },
        "style": {
          "showBackground": true,
          "backgroundColor": "#5C5567"
        }
      },
      {
        "type": "button",
        "id": "btn_start",
        "position": {
          "x": 0.670953255766483,
          "y": 0.08580718122702856
        },
        "size": {
          "width": 0.15309246785058175,
          "height": 0.16963528413910095
        },
        "shape": "rectangle",
        "command": "start",
        "content": {
          "type": "text",
          "text": "Start"
        },
        "style": {
          "showBackground": true,
          "backgroundColor": "#5C5567"
        }
      },
      {
        "type": "button",
        "id": "btn_stick_left_click",
        "position": {
          "x": 0.04582567870994081,
          "y": 0.9339836019225333
        },
        "size": {
          "width": 0.07654623392529088,
          "height": 0.16963528413910095
        },
        "shape": "circle",
        "command": "stick_left_click",
        "content": {
          "type": "image",
          "image": {
            "type": "url",
            "value": "data:image/jpeg;base64,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",
            "scaleType": "fill"
          }
        },
        "style": {
          "showBackground": true,
          "backgroundColor": "#454050"
        }
      },
      {
        "type": "button",
        "id": "btn_stick_right_click",
        "position": {
          "x": 0.9643804858134314,
          "y": 0.9339836019225333
        },
        "size": {
          "width": 0.07654623392529088,
          "height": 0.16963528413910095
        },
        "shape": "circle",
        "command": "stick_right_click",
        "content": {
          "type": "image",
          "image": {
            "type": "url",
            "value": "data:image/jpeg;base64,/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDAAUDBAQEAwUEBAQFBQUGBwwIBwcHBw8LCwkMEQ8SEhEPERETFhwXExQaFRERGCEYGh0dHx8fExciJCIeJBweHx7/2wBDAQUFBQcGBw4ICA4eFBEUHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh7/wAARCACgAKADASIAAhEBAxEB/8QAHwAAAQUBAQEBAQEAAAAAAAAAAAECAwQFBgcICQoL/8QAtRAAAgEDAwIEAwUFBAQAAAF9AQIDAAQRBRIhMUEGE1FhByJxFDKBkaEII0KxwRVS0fAkM2JyggkKFhcYGRolJicoKSo0NTY3ODk6Q0RFRkdISUpTVFVWV1hZWmNkZWZnaGlqc3R1dnd4eXqDhIWGh4iJipKTlJWWl5iZmqKjpKWmp6ipqrKztLW2t7i5usLDxMXGx8jJytLT1NXW19jZ2uHi4+Tl5ufo6erx8vP09fb3+Pn6/8QAHwEAAwEBAQEBAQEBAQAAAAAAAAECAwQFBgcICQoL/8QAtREAAgECBAQDBAcFBAQAAQJ3AAECAxEEBSExBhJBUQdhcRMiMoEIFEKRobHBCSMzUvAVYnLRChYkNOEl8RcYGRomJygpKjU2Nzg5OkNERUZHSElKU1RVVldYWVpjZGVmZ2hpanN0dXZ3eHl6goOEhYaHiImKkpOUlZaXmJmaoqOkpaanqKmqsrO0tba3uLm6wsPExcbHyMnK0tPU1dbX2Nna4uPk5ebn6Onq8vP09fb3+Pn6/9oADAMBAAIRAxEAPwDx2iiiusoKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAor0ay+B/xQvLOC8tvDG+CeNZI2+32w3KwyDgyZHBqX/hQ/xX/6FX/yoWv/AMcpcy7iPNKK7fWvhL8R9Hgae98I6h5ajLNAFnwPU+WWriWBUkEEEcEHtTTuMSirej6deavq1ppWnxedeXkyQQR7gu52ICjJwByepr1ix/Zw+I9wgaZdIsz/AHZrwk/+OKwpNpbgeOUV7Xc/s0fEKKMvHeaBOQPuR3UgJ/76jA/WvOfG3gXxX4MmSPxHo09mkhxHNw8Tn0DqSue+M59qFJMRzVFFFMYUUUUAFFFFABRRRQAUUUUAFFFFAH6L+DP+RP0X/sHwf+i1rgfHfx28IeDvFl54a1TT9clu7Py/Mkt4ImjO+NXGCZAejDt1zXfeDP8AkT9F/wCwfB/6LWvmz47/AAk+IPif4sazreiaALrT7nyPKmN5Am7bBGjfKzhhhlI6dq54pN6kn0T4C8Y6F430EazoFy81uJDFIsibXicAEqw9cEHuOa+f/wBsvwfp1jNpni6wt0t5ryVra9CDAlfbuRyP72AwJ74Feofs4+ANV8A+D7q21uSH7ffXXnvFE+5YlChQpPQngk446V5j+2b4u0+8fS/CFlOk9xaTNdXuw5ETbdqIf9rDMSO3HrTj8WgzwnwPq0Gg+M9F1u5jklgsL6G5kSPG5lRwxAzxnivbdc/aj1uSdhonhjTreIH5TeSvMx9/l2Y+nNfPNep/BH4Q/wDCy9O1K7/4SH+yvsMyR7fsXnb9wJzneuOnvWskt2B6z8G/2gb7xT4ttPDniPR7O3kvWKW9zZlgofBIVkYscHGMg9ccdx7R430Kx8S+E9S0TUYkkgurdl+YfcbHyuPQg4IPtXm3wr+Aeh+CvEMOv3Wr3Gr39tk2+6EQxRsQRu25Yk4JxzgemcYT9o/4nXPhHQbjRdN0nUftt/E0KahJAUtogww21z99wM4A6de2Di0m/dA+NaKKK6BhRRRQAUUUUAFFFFABRRRQAUUUUAfov4M/5E/Rf+wfB/6LWuF8Z/HLwd4S8ZXXhfV7XWFubUxiWeKBGhG9FcEHfuPDDPy+td14M/5E/Rf+wfB/6LWvjP8Aag/5Ln4i/wC3b/0mirnhFN6kn2baXWk+LPDKXNhevcabqEOUntZ3iYqeOGUhlI6HoQQQa+Kvjx8PLj4feLzAs011pl8GmsriXl2GfmRj3ZSRk9wQe+B6P+xz44+y6ndeBr+b9zd5udP3H7soHzoPqo3D/dPrXsnx68EL45+Ht3YwRBtStP8ASrA9zIoOU/4EMr9SD2pr3JWGfCNdV4I+IXjDwVb3Nv4Z1f7BFdOHmX7NFLuIGAfnU469q2vgF4O0rxt47m8P64LhIDYyuGhfZJG6lcEZBHGTwQRXoevfsua0lwx0HxNp9xCT8ovY3iYD0JQMD9cCtXJbMCH4T/tB+K5fFen6T4ra21KyvbhLdp1gWKWEuQob5AFIBPIxnHQ19NeJtE03xHoV3our2y3FndRlJFYdPRh6MDyD2Irwf4Xfs43Gi+JbLW/FOsWlyLKZZ4rSzVirupypZ2A4BAOMc+te5eMvEmleE/Dl3rusXCw21uhOCfmkb+FFHdieAKxna/uiPz21ywfStavtMkbc9ncyQM2OpRipP6VTq1q99LqerXmpTgCW7ned8dNzsWP6mqtdBQUUUUAFFFFABRRRQAUUUUAFFFFAHo1l8cPihZ2cFnbeJ9kEEaxxr9gtjtVRgDJjyeBXGeKNe1bxNrtzrmuXf2vULnb503lqm7aoRflUAD5VA4HasyikkkItaTqF5pOp22p6dcNb3lrKs0Mq9UdTkHng/Q16F/wvj4r/APQ1f+U+1/8AjdeZ0UNJ7jNuw8WeIbDxNN4lsNTls9VnkeSWe3VY9xc5b5VAXBPOMY9q9G0r9o34kWcQS4l0rUSB965s8E/9+yorx6ihxTA9nvv2lPiJcxlIYtDsyf44bRiR/wB9uw/SvNPF3i3xJ4tvFu/EWsXWoSLnYJGwiZ67UGFX8AKw6KFFLYQUUUUxhRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAf/9k=",
            "scaleType": "fill"
          }
        },
        "style": {
          "showBackground": true,
          "backgroundColor": "#454050"
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
      "face_a": "A",
      "face_b": "B",
      "face_x": "X",
      "face_y": "Y",
      "shoulder_left": "LeftShoulder",
      "shoulder_right": "RightShoulder",
      "dpad_up": "Up",
      "dpad_down": "Down",
      "dpad_left": "Left",
      "dpad_right": "Right",
      "start": "Start",
      "back": "Back",
      "stick_left_click": "LeftThumb",
      "stick_right_click": "RightThumb"
    },
    "axisMap": {},
    "sensorMap": {}
  }
}
""");
            insertCommand2.ExecuteNonQuery();
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
