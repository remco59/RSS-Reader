/// <reference path="../pb_data/types.d.ts" />
migrate((app) => {
    const collection = new Collection({
        "id": "user_feeds0001",
        "name": "user_feeds",
        "type": "base",
        "fields": [
            { "type": "relation", "name": "user", "required": true, "collectionId": "_pb_users_auth_",  "cascadeDelete": true, "maxSelect": 1 },
            { "type": "relation", "name": "feed", "required": true, "collectionId": "feeds000000001", "cascadeDelete": true, "maxSelect": 1 },
            { "type": "text",     "name": "alias",                  "max": 200 }
        ],
        "indexes": [
            "CREATE UNIQUE INDEX idx_user_feeds_pair ON user_feeds (user, feed)"
        ],
        "listRule":   "@request.auth.id = user",
        "viewRule":   "@request.auth.id = user",
        "createRule": "@request.auth.id = user",
        "updateRule": "@request.auth.id = user",
        "deleteRule": "@request.auth.id = user"
    });
    app.save(collection);
}, (app) => {
    app.delete(app.findCollectionByNameOrId("user_feeds0001"));
});
