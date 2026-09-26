import pandas as pd


def preview_data(csv_path: str = "products.csv") -> pd.DataFrame:
    try:
        df = pd.read_csv(csv_path)
    except FileNotFoundError:
        df = pd.DataFrame(
            {
                "item_name": ["bread", "oil", "sugar"],
                "item_price": [120, 3500, 1500],
                "item_weight": [70, 1000, 500],
                "unit_cost": [1.71, 3.5, 3.0],
                "status": ["inflation-risk", "stable", "stable"],
            }
        )

    if not df.empty:
        df["unit_cost"] = df["item_price"] / df["item_weight"]
        df["status"] = df["unit_cost"].apply(lambda value: "inflation-risk" if value > 0.5 else "stable")
    return df


if __name__ == "__main__":
    data = preview_data()
    print(data.head())
    print(f"\nRows: {len(data)}")
