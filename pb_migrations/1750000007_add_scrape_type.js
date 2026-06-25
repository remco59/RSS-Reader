/// <reference path="../pb_data/types.d.ts" />
migrate((app) => {
    const collection = app.findCollectionByNameOrId("feeds000000001");

    // Add scrape as a supported feed type for universal website scraping.
    const typeField = collection.fields.getByName("type");
    typeField.values.push("scrape");

    // Optional CSS selector config for sites where auto-detection falls short.
    // Stores a JSON-encoded object with keys: item_selector, link_selector,
    // title_selector, image_selector, date_selector, url_pattern.
    collection.fields.add(new TextField({
        "name": "scrape_config",
        "max": 2000
    }));

    app.save(collection);
}, (app) => {
    const collection = app.findCollectionByNameOrId("feeds000000001");

    const typeField = collection.fields.getByName("type");
    typeField.values = typeField.values.filter((v) => v !== "scrape");

    collection.fields.removeByName("scrape_config");
    app.save(collection);
});
