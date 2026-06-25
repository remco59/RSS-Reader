/// <reference path="../pb_data/types.d.ts" />
migrate((app) => {
    const collection = new Collection({
        "id": "user_articles01",
        "name": "user_articles",
        "type": "base",
        "fields": [
            { "type": "relation", "name": "user",          "required": true, "collectionId": "_pb_users_auth_",  "cascadeDelete": true, "maxSelect": 1 },
            { "type": "relation", "name": "article",       "required": true, "collectionId": "articles000001", "cascadeDelete": true, "maxSelect": 1 },
            { "type": "date",     "name": "read_at" },
            { "type": "date",     "name": "bookmarked_at" }
        ],
        "indexes": [
            "CREATE UNIQUE INDEX idx_user_articles_pair ON user_articles (user, article)",
            "CREATE INDEX idx_user_articles_bookmarked ON user_articles (bookmarked_at) WHERE bookmarked_at != ''"
        ],
        "listRule":   "@request.auth.id = user",
        "viewRule":   "@request.auth.id = user",
        "createRule": "@request.auth.id = user",
        "updateRule": "@request.auth.id = user",
        "deleteRule": "@request.auth.id = user"
    });
    app.save(collection);
}, (app) => {
    app.delete(app.findCollectionByNameOrId("user_articles01"));
});
