/// <reference path="../pb_data/types.d.ts" />
migrate((app) => {
    const collection = app.findCollectionByNameOrId("feeds000000001");

    // Add facebook_public_page as a supported feed type.
    // Unlike the existing "facebook" type (Playwright-based), this type uses
    // plain HTTP fetching — it works only for fully public Pages/Groups.
    const typeField = collection.fields.getByName("type");
    typeField.values.push("facebook_public_page");

    // Error tracking so the UI can surface fetch failures without reading logs.
    collection.fields.add(new TextField({
        "name": "last_error",
        "max": 1000
    }));

    collection.fields.add(new DateField({
        "name": "last_error_at"
    }));

    app.save(collection);
}, (app) => {
    const collection = app.findCollectionByNameOrId("feeds000000001");

    const typeField = collection.fields.getByName("type");
    typeField.values = typeField.values.filter((v) => v !== "facebook_public_page");

    collection.fields.removeByName("last_error");
    collection.fields.removeByName("last_error_at");

    app.save(collection);
});
