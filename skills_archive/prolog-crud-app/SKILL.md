---
name: prolog-crud-app
description: Building a CRUD app in SWI-Prolog -- HTTP server, JSON handling, SQLite integration, session management, file I/O, REST API patterns, practical web development. Trigger on prolog web, prolog http, prolog json, prolog sqlite, prolog crud, prolog rest api, prolog server, prolog session.
license: MIT
metadata:
  audience: developers
  workflow: word-linker
---

# Building a CRUD App in SWI-Prolog

SWI-Prolog has a surprisingly capable built-in HTTP server. No npm, no external web framework. This guide walks you through building real, runnable REST APIs in Prolog — the kind of stuff you'd normally reach for Express for. If you know TypeScript and RxJS, you already think in data transformations and reactive patterns. Prolog is the same mental model, just with unification instead of destructuring.


## The Big Picture: How Prolog Web Dev Works

In Express, you define routes and attach handlers:
```javascript
app.get('/todos', (req, res) => {
  res.json({ todos: [] });
});
```

In SWI-Prolog, you do the same thing, but your "handler" is a predicate. The HTTP server pattern-matches requests and calls your predicates.

```prolog
:- http_handler(root(api/todos), todos_handler, []).

todos_handler(Request) :-
    reply_json_dict(_{todos: []}).
```

The server runs in the background. You define handlers, load the module, and call `server(8080)`. That's it.


## Part 1: HTTP Server Setup

Before you can handle requests, you need to load the HTTP libraries and start a server.

```prolog
:- use_module(library(http/thread_httpd)).
:- use_module(library(http/http_dispatch)).
:- use_module(library(http/http_json)).
:- use_module(library(http/http_parameters)).
:- use_module(library(http/http_methods)).

% Define a route
:- http_handler(root(.), home_handler, []).

% The home handler. Request is a data structure with headers, method, etc.
home_handler(_Request) :-
    reply_json_dict(_{status: ok, message: "Hello from Prolog!"}).

% Start the server on a given port
server(Port) :-
    http_server(http_dispatch, [port(Port)]).

% Usage: ?- server(8080).
% Then visit http://localhost:8080 in your browser.
```

Compare this to Express:
- `http_handler(root(api/todos), todos_handler, [])` is like `app.get('/api/todos', todos_handler)`
- `reply_json_dict(_{ ... })` is like `res.json({ ... })`
- `http_dispatch` is the routing engine, like your Express app object
- `Port` parameter works exactly like Express's `listen()`

What happens when you load this file and call `server(8080)`: The HTTP server spawns in a background thread. Any GET request to `/` calls `home_handler`. The underscore `_Request` means we ignore the request object (you don't need it for a simple response).


## Part 2: JSON Handling

Prolog has a built-in dict syntax that maps directly to JSON. The `_{key: value}` notation creates a dict. When you send it over HTTP, it becomes JSON automatically.

```prolog
:- use_module(library(http/http_json)).

% Reading JSON from a POST request body
handle_post_example(Request) :-
    http_read_json_dict(Request, Data),
    % Data is now a dict: _{title: "Buy milk", done: false}
    % Access fields with _{title: Title, done: Done} = Data
    write('Received: '), write(Data), nl.

% Sending JSON with multiple fields
send_example_response :-
    reply_json_dict(_{
        status: success,
        todos: [
            _{id: 1, title: "Buy milk", done: false},
            _{id: 2, title: "Learn Prolog", done: true}
        ]
    }).

% Sending JSON with status codes
send_error_response :-
    reply_json_dict(
        _{error: "Not found"},
        [status(404)]  % HTTP 404 status
    ).
```

When you call `http_read_json_dict(Request, Data)`, the JSON body becomes a Prolog dict. When you call `reply_json_dict(Dict)`, the dict becomes JSON and is sent to the client with `Content-Type: application/json`.

This is cleaner than Express's `req.body` and `res.json()` because there's no middleware pipeline. The conversion happens automatically.


## Part 3: Full TODO CRUD API

Now let's build a real REST API with all five CRUD operations. We'll start with in-memory storage using Prolog's `assert/retract` system (think of it like a global mutable state).

```prolog
:- use_module(library(http/thread_httpd)).
:- use_module(library(http/http_dispatch)).
:- use_module(library(http/http_json)).
:- use_module(library(http/http_parameters)).

% Routes
:- http_handler(root(api/todos), todos_list_handler, [method(get)]).
:- http_handler(root(api/todos), todos_create_handler, [method(post)]).
:- http_handler(root('api/todos/<id>'), todos_get_handler, [method(get)]).
:- http_handler(root('api/todos/<id>'), todos_update_handler, [method(put)]).
:- http_handler(root('api/todos/<id>'), todos_delete_handler, [method(delete)]).

% Global counter for next ID
:- dynamic(next_id/1).
next_id(1).

% In-memory storage: todo(ID, Title, Done)
:- dynamic(todo/3).

% GET /api/todos - List all todos
todos_list_handler(_Request) :-
    findall(_{id: ID, title: Title, done: Done},
            todo(ID, Title, Done),
            Todos),
    reply_json_dict(_{todos: Todos}).

% POST /api/todos - Create a todo
todos_create_handler(Request) :-
    http_read_json_dict(Request, _{title: Title}),
    % Get next ID
    retract(next_id(ID)),
    NextID is ID + 1,
    assert(next_id(NextID)),
    % Store the todo
    assert(todo(ID, Title, false)),
    reply_json_dict(_{id: ID, title: Title, done: false}, [status(201)]).

% GET /api/todos/<id> - Get one todo
todos_get_handler(Request) :-
    http_parameters(Request, [id(ID, [integer])]),
    (   todo(ID, Title, Done)
    ->  reply_json_dict(_{id: ID, title: Title, done: Done})
    ;   reply_json_dict(_{error: "Not found"}, [status(404)])
    ).

% PUT /api/todos/<id> - Update a todo
todos_update_handler(Request) :-
    http_parameters(Request, [id(ID, [integer])]),
    http_read_json_dict(Request, Data),
    (   todo(ID, _, _)
    ->  retract(todo(ID, _, _)),
        get_dict(title, Data, Title, _),
        get_dict(done, Data, Done, false),
        assert(todo(ID, Title, Done)),
        reply_json_dict(_{id: ID, title: Title, done: Done})
    ;   reply_json_dict(_{error: "Not found"}, [status(404)])
    ).

% DELETE /api/todos/<id> - Delete a todo
todos_delete_handler(Request) :-
    http_parameters(Request, [id(ID, [integer])]),
    (   retract(todo(ID, _, _))
    ->  reply_json_dict(_{status: deleted}, [status(200)])
    ;   reply_json_dict(_{error: "Not found"}, [status(404)])
    ).

% Start the server
server(Port) :-
    http_server(http_dispatch, [port(Port)]).
```

Load this file and run `?- server(8080).` Now you have a working REST API. Let's trace through what happens:

- **GET /api/todos**: `findall` collects all `todo(ID, Title, Done)` facts into a list and returns JSON
- **POST /api/todos**: Read the JSON body, generate a new ID, store with `assert`, return 201
- **GET /api/todos/1**: Extract the `id` parameter from the URL, fetch the todo, return it or 404
- **PUT /api/todos/1**: Extract ID and body, find and replace the old fact with the new one
- **DELETE /api/todos/1**: Remove the fact with `retract`

This maps directly to Express:
```javascript
// Express
app.get('/api/todos', (req, res) => res.json({ todos }));
app.post('/api/todos', (req, res) => { todos.push(req.body); res.status(201).json(...) });

// Prolog
todos_list_handler(_) :- findall(...), reply_json_dict(_{todos: ...}).
todos_create_handler(R) :- http_read_json_dict(R, D), assert(todo(...)), reply_json_dict(...).
```

The Prolog version is actually shorter because there's no intermediate mutable array. The database (assert/retract) IS the data structure.


## Part 4: Persistent Storage with SQLite

In-memory storage is fun for demos, but a real app needs a database. SWI-Prolog ships with SQLite support.

```prolog
:- use_module(library(http/thread_httpd)).
:- use_module(library(http/http_dispatch)).
:- use_module(library(http/http_json)).
:- use_module(library(http/http_parameters)).
:- use_module(library(sqlite3)).

% Database file
:- dynamic(db_handle/1).

% Initialize the database
init_db :-
    sqlite_connect('todos.db', DB, []),
    assert(db_handle(DB)),
    sqlite_query(DB,
        "CREATE TABLE IF NOT EXISTS todos (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            title TEXT NOT NULL,
            done INTEGER DEFAULT 0
        )",
        []),
    sqlite_close(DB).

% Wrapper to get DB handle
with_db(Goal) :-
    (   db_handle(DB)
    ->  call(Goal, DB)
    ;   throw(error(database_not_initialized))
    ).

% GET /api/todos - Fetch from SQLite
todos_list_handler(_Request) :-
    with_db(get_all_todos),
    reply_json_dict(_{todos: Todos}).

get_all_todos(DB, Todos) :-
    sqlite_query(DB,
        "SELECT id, title, done FROM todos ORDER BY id",
        Rows,
        [functor(row), as(dict)]),
    Todos = Rows.

% POST /api/todos - Insert into SQLite
todos_create_handler(Request) :-
    http_read_json_dict(Request, _{title: Title}),
    with_db(insert_todo(Title)),
    reply_json_dict(_{status: created}, [status(201)]).

insert_todo(Title, DB) :-
    sqlite_query(DB,
        "INSERT INTO todos (title, done) VALUES (?, 0)",
        [Title]),
    sqlite_query(DB,
        "SELECT last_insert_rowid() AS id",
        [row(ID)],
        [functor(row)]).

% GET /api/todos/<id>
todos_get_handler(Request) :-
    http_parameters(Request, [id(ID, [integer])]),
    with_db(get_todo(ID, Todo)),
    (   Todo = _{id: _, title: _, done: _}
    ->  reply_json_dict(Todo)
    ;   reply_json_dict(_{error: "Not found"}, [status(404)])
    ).

get_todo(ID, Todo, DB) :-
    sqlite_query(DB,
        "SELECT id, title, done FROM todos WHERE id = ?",
        [ID],
        [Todo],
        [functor(row), as(dict)]),
    !.
get_todo(_, null, _).

% PUT /api/todos/<id>
todos_update_handler(Request) :-
    http_parameters(Request, [id(ID, [integer])]),
    http_read_json_dict(Request, _{title: Title, done: Done}),
    with_db(update_todo(ID, Title, Done)),
    reply_json_dict(_{id: ID, title: Title, done: Done}).

update_todo(ID, Title, Done, DB) :-
    sqlite_query(DB,
        "UPDATE todos SET title = ?, done = ? WHERE id = ?",
        [Title, Done, ID]).

% DELETE /api/todos/<id>
todos_delete_handler(Request) :-
    http_parameters(Request, [id(ID, [integer])]),
    with_db(delete_todo(ID)),
    reply_json_dict(_{status: deleted}).

delete_todo(ID, DB) :-
    sqlite_query(DB,
        "DELETE FROM todos WHERE id = ?",
        [ID]).

% Routes
:- http_handler(root(api/todos), todos_list_handler, [method(get)]).
:- http_handler(root(api/todos), todos_create_handler, [method(post)]).
:- http_handler(root('api/todos/<id>'), todos_get_handler, [method(get)]).
:- http_handler(root('api/todos/<id>'), todos_update_handler, [method(put)]).
:- http_handler(root('api/todos/<id>'), todos_delete_handler, [method(delete)]).

server(Port) :-
    init_db,
    http_server(http_dispatch, [port(Port)]).
```

How does this compare to Node.js with better-sqlite3?

```javascript
// Node.js
const db = new Database('todos.db');
const rows = db.prepare('SELECT * FROM todos').all();
res.json({ todos: rows });

// Prolog
sqlite_query(DB, "SELECT id, title, done FROM todos", Rows, [functor(row), as(dict)]),
reply_json_dict(_{todos: Rows}).
```

The pattern is almost identical. `sqlite_query` takes a SQL string, parameters, and options. The `as(dict)` option automatically converts rows to dicts. The `functor(row)` tells SQLite how to structure each result.

One key difference: Prolog doesn't have connection pooling in the traditional sense. You store the DB handle in a dynamic fact (`db_handle(DB)`) and fetch it when needed. For a single-threaded app this is fine. For high concurrency, you'd want to use SWI-Prolog's thread library to manage a pool.


## Part 5: Session Management

Real apps need to track logged-in users. SWI-Prolog has a built-in session library.

```prolog
:- use_module(library(http/http_session)).

% Configure session timeout (3600 seconds = 1 hour)
:- http_set_session_options([timeout(3600)]).

% Define a route for login
:- http_handler(root(login), login_handler, [method(post)]).
:- http_handler(root(me), current_user_handler, [method(get)]).

% Authenticate a user (simplified: just check username/password)
authenticate(User, Pass) :-
    % In a real app, check against a password hash
    \+ \+ member(User-Pass, [admin-password123, user-secret]).

% Login: validate credentials and store session data
login_handler(Request) :-
    http_read_json_dict(Request, _{username: User, password: Pass}),
    (   authenticate(User, Pass)
    ->  http_session_assert(user(User)),
        http_session_assert(login_time(get_time)),
        reply_json_dict(_{status: "logged_in", user: User}, [status(200)])
    ;   reply_json_dict(_{error: "Invalid credentials"}, [status(401)])
    ).

% Protected route: fetch current user from session
current_user_handler(_Request) :-
    (   http_session_data(user(User))
    ->  reply_json_dict(_{user: User, authenticated: true})
    ;   reply_json_dict(_{error: "Not authenticated"}, [status(401)])
    ).
```

How this works:

1. Client POSTs to `/login` with `{username: "admin", password: "password123"}`
2. Server validates credentials with `authenticate/2`
3. If valid, server stores `user(User)` in the session with `http_session_assert`
4. Server returns a Set-Cookie header with the session ID
5. Client stores the cookie
6. On next request, server automatically loads session data with `http_session_data`
7. Protected handlers check if `user(X)` exists in the session

This maps to Express middleware:

```javascript
// Express
app.use(session({ secret: 'xxx', resave: false, saveUninitialized: false }));
app.post('/login', (req, res) => {
    if (authenticate(req.body.username, req.body.password)) {
        req.session.user = req.body.username;
        res.json({ status: 'logged_in' });
    } else {
        res.status(401).json({ error: 'Invalid credentials' });
    }
});
app.get('/me', (req, res) => {
    if (req.session.user) {
        res.json({ user: req.session.user });
    } else {
        res.status(401).json({ error: 'Not authenticated' });
    }
});

// Prolog
:- http_set_session_options([timeout(3600)]).
login_handler(...) :- http_session_assert(user(User)), ...
current_user_handler(_) :- http_session_data(user(User)), ...
```

Prolog's session management is actually simpler. No middleware chains, no callback hell. The session data is just stored as facts, and the HTTP library handles cookie serialization for you.


## Part 6: File I/O

Many apps need to read and write files. Prolog has straightforward file predicates.

```prolog
:- use_module(library(http/http_reply)).

% Read an entire file into a string
read_file(Path, Content) :-
    read_file_to_string(Path, Content, []).

% Read a file line-by-line
read_lines(Path, Lines) :-
    read_file_to_string(Path, String, []),
    split_string(String, "\n", "", Lines).

% Write a string to a file
write_file(Path, Content) :-
    open(Path, write, Stream),
    write(Stream, Content),
    close(Stream).

% Append to a file
append_file(Path, Content) :-
    open(Path, append, Stream),
    write(Stream, Content),
    close(Stream).

% Serve a file over HTTP
serve_static_file(Request) :-
    http_reply_from_files('static', [], Request).

% Create a download endpoint
download_handler(Request) :-
    http_parameters(Request, [file(FileName, [atom])]),
    atomic_list_concat(['uploads/', FileName], FilePath),
    http_reply_from_files('uploads', [FileName], Request).

% Routes
:- http_handler(root(static), serve_static_file, [prefix]).
:- http_handler(root(download), download_handler, []).
```

These are straightforward:
- `read_file_to_string(Path, Content, [])` reads the entire file
- `split_string(String, "\n", "", Lines)` splits on newlines
- `open(Path, write, Stream), write(Stream, Data), close(Stream)` writes
- `http_reply_from_files(Dir, [], Request)` serves static files from a directory

Compare to Node.js:

```javascript
// Node.js
const content = fs.readFileSync(path, 'utf-8');
fs.writeFileSync(path, content);
app.use(express.static('static'));

// Prolog
read_file_to_string(Path, Content, []).
write_file(Path, Content).
:- http_handler(root(static), serve_static_file, [prefix]).
```

The Prolog versions are a bit more explicit (you have to close streams), but they're also more powerful. You have full control over encoding, buffering, and error handling.


## Part 7: Error Handling

Real apps need graceful error handling. Prolog's `catch/3` is your friend.

```prolog
% Wrap a handler with error handling
safe_handler(Request, Handler) :-
    catch(
        call(Handler, Request),
        Error,
        handle_error(Error)
    ).

% Different error types get different responses
handle_error(http_exception(Status, Message)) :-
    format(string(Body), '{"error": "~w"}', [Message]),
    reply_json_dict(_{error: Message}, [status(Status)]).

handle_error(database_error(Message)) :-
    format(string(Body), '{"error": "Database error"}', [Message]),
    reply_json_dict(_{error: "Database error"}, [status(500)]).

handle_error(Error) :-
    format(string(Msg), '~w', [Error]),
    reply_json_dict(_{error: Msg}, [status(500)]).

% Usage: wrap your handler
todos_list_handler(Request) :-
    safe_handler(Request, todos_list_impl).

todos_list_impl(Request) :-
    with_db(get_all_todos, Todos),
    reply_json_dict(_{todos: Todos}).
```

Or simpler, if you just want to catch everything:

```prolog
todos_list_handler(Request) :-
    catch(
        (with_db(get_all_todos, Todos), reply_json_dict(_{todos: Todos})),
        Error,
        (format(string(Msg), '~w', [Error]), reply_json_dict(_{error: Msg}, [status(500)]))
    ).
```

This is like Express error middleware:

```javascript
app.use((err, req, res, next) => {
    res.status(500).json({ error: err.message });
});
```

In Prolog, you call `catch` at the point where you want error handling, not as global middleware.


## Part 8: The Complete Example

Here's a full, runnable TODO app that combines everything. Copy this into a file, run `swipl`, and load it.

```prolog
:- use_module(library(http/thread_httpd)).
:- use_module(library(http/http_dispatch)).
:- use_module(library(http/http_json)).
:- use_module(library(http/http_parameters)).
:- use_module(library(http/http_session)).
:- use_module(library(sqlite3)).
:- use_module(library(apply_macros)).

% Initialize database
:- dynamic(db_handle/1).

init_db :-
    sqlite_connect('todos.db', DB, []),
    assert(db_handle(DB)),
    sqlite_query(DB,
        "CREATE TABLE IF NOT EXISTS todos (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            title TEXT NOT NULL,
            done INTEGER DEFAULT 0
        )", []),
    sqlite_query(DB,
        "CREATE TABLE IF NOT EXISTS users (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            username TEXT UNIQUE NOT NULL,
            password TEXT NOT NULL
        )", []).

with_db(Goal) :-
    (db_handle(DB) -> call(Goal, DB) ; throw(error(no_db))).

% Routes
:- http_handler(root(api/todos), todos_list, [method(get)]).
:- http_handler(root(api/todos), todos_create, [method(post)]).
:- http_handler(root('api/todos/<id>'), todos_get, [method(get)]).
:- http_handler(root('api/todos/<id>'), todos_update, [method(put)]).
:- http_handler(root('api/todos/<id>'), todos_delete, [method(delete)]).
:- http_handler(root(auth/login), login, [method(post)]).
:- http_handler(root(auth/me), current_user, [method(get)]).

% Handlers
todos_list(_) :-
    catch(
        (with_db(fetch_todos, Todos), reply_json_dict(_{todos: Todos})),
        _, reply_json_dict(_{error: "Database error"}, [status(500)])
    ).

todos_create(Request) :-
    catch(
        (http_read_json_dict(Request, _{title: Title}),
         with_db(insert_todo(Title), _),
         reply_json_dict(_{status: created}, [status(201)])),
        _, reply_json_dict(_{error: "Bad request"}, [status(400)])
    ).

todos_get(Request) :-
    http_parameters(Request, [id(ID, [integer])]),
    catch(
        (with_db(fetch_todo(ID), Todo),
         (Todo \= null -> reply_json_dict(Todo) ; reply_json_dict(_{error: "Not found"}, [status(404)]))),
        _, reply_json_dict(_{error: "Error"}, [status(500)])
    ).

todos_update(Request) :-
    http_parameters(Request, [id(ID, [integer])]),
    catch(
        (http_read_json_dict(Request, Data),
         with_db(update_todo(ID, Data), _),
         reply_json_dict(_{status: updated})),
        _, reply_json_dict(_{error: "Error"}, [status(500)])
    ).

todos_delete(Request) :-
    http_parameters(Request, [id(ID, [integer])]),
    catch(
        (with_db(delete_todo(ID), _), reply_json_dict(_{status: deleted})),
        _, reply_json_dict(_{error: "Error"}, [status(500)])
    ).

login(Request) :-
    catch(
        (http_read_json_dict(Request, _{username: User, password: Pass}),
         (User == admin, Pass == admin ->
             http_session_assert(user(User)),
             reply_json_dict(_{status: ok, user: User})
         ;
             reply_json_dict(_{error: "Invalid"}, [status(401)]))
        ),
        _, reply_json_dict(_{error: "Error"}, [status(500)])
    ).

current_user(_) :-
    (http_session_data(user(U)) ->
        reply_json_dict(_{user: U})
    ;
        reply_json_dict(_{error: "Not authenticated"}, [status(401)])
    ).

% Database operations
fetch_todos(Todos, DB) :-
    sqlite_query(DB, "SELECT id, title, done FROM todos ORDER BY id",
        Todos, [functor(row), as(dict)]).

fetch_todo(ID, Todo, DB) :-
    sqlite_query(DB, "SELECT id, title, done FROM todos WHERE id = ?", [ID],
        [Todo], [functor(row), as(dict)]), !.
fetch_todo(_, null, _).

insert_todo(Title, _, DB) :-
    sqlite_query(DB, "INSERT INTO todos (title, done) VALUES (?, 0)", [Title]).

update_todo(ID, _{title: Title, done: Done}, _, DB) :-
    sqlite_query(DB, "UPDATE todos SET title = ?, done = ? WHERE id = ?",
        [Title, Done, ID]).

delete_todo(ID, _, DB) :-
    sqlite_query(DB, "DELETE FROM todos WHERE id = ?", [ID]).

% Start server
start(Port) :-
    init_db,
    http_set_session_options([timeout(3600)]),
    http_server(http_dispatch, [port(Port)]),
    format('Server running on port ~w~n', [Port]).
```

Load this and run `?- start(8080).` Now test it:

```bash
# Get todos
curl http://localhost:8080/api/todos

# Create a todo
curl -X POST http://localhost:8080/api/todos \
  -H "Content-Type: application/json" \
  -d '{"title":"Buy milk"}'

# Login
curl -X POST http://localhost:8080/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"admin","password":"admin"}'

# Get current user (with session cookie)
curl http://localhost:8080/auth/me \
  -H "Cookie: [session_id_from_login]"
```


## Part 9: Express.js to Prolog Mapping

If you know Express, here's how concepts map:

| Express | Prolog | Notes |
| --- | --- | --- |
| `app.get('/path', handler)` | `:- http_handler(root(path), handler, [method(get)]).` | Declarative routing |
| `app.post('/path', handler)` | `:- http_handler(root(path), handler, [method(post)]).` | Same pattern for all methods |
| `req.body` | `http_read_json_dict(Request, Body)` | Auto JSON parsing |
| `req.params.id` | `http_parameters(Request, [id(ID, [integer])])` | Type coercion built-in |
| `res.json({})` | `reply_json_dict(_{...})` | Auto JSON encoding |
| `res.status(201)` | `reply_json_dict(_, [status(201)])` | Status in options |
| `express.static('dir')` | `http_reply_from_files('dir', [], Request)` | One-liner |
| Session middleware | `:- http_set_session_options(...)` + `http_session_assert` | Declarative, built-in |
| `fs.readFileSync` | `read_file_to_string` | Standard predicates |
| `catch((req, res) => ...)` | `catch(handler(...), Error, handle_error(...))` | Same pattern |
| Database queries | `sqlite_query(DB, SQL, Params, Results)` | Direct SQL with params |

The key insight: Prolog's HTTP library is not a framework. It's a minimal set of predicates. You compose them like building blocks. No middleware chains, no app object, no `next()` callbacks. Just predicates calling predicates.


## Part 10: Why This Actually Works

Prolog's HTTP library works because:

1. **Declarative routing**: You declare routes at load time, not at runtime. No registration overhead.
2. **Pattern matching**: Your handlers are predicates. The HTTP server pattern-matches the request and calls the right handler.
3. **Backtracking**: If a handler fails, the server can try the next matching route (though most handlers should succeed or throw).
4. **Built-in session management**: Cookies and session data are handled by the library. You don't have to think about serialization.
5. **JSON-native dicts**: Prolog dicts are a first-class type. They convert to/from JSON automatically.
6. **Threading**: The HTTP server runs in a background thread. Your REPL stays responsive. You can query data while the server is running.

For small to medium apps (say, a microservice, a config API, a data pipeline UI), this is genuinely faster to write than Express. You don't need npm modules for basic things. No connection pooling boilerplate. No middleware ordering bugs.

For large apps, you might want more structure. But for "I need a REST API right now", Prolog delivers.
