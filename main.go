package main

import (
    "encoding/json"
    "fmt"
    "log"
    "net/http"
    "os"
    "path/filepath"
    "strconv"
    "strings"
    "sync"
)

type Product struct {
    ID        int     `json:"id"`
    ItemName  string  `json:"item_name"`
    ItemPrice float64 `json:"item_price"`
    ItemWeight float64 `json:"item_weight"`
    UnitCost  float64 `json:"unit_cost"`
    Status    string  `json:"status"`
}

type AppState struct {
    mu      sync.Mutex
    items   []Product
    nextID  int
}

func (s *AppState) addProduct(itemName string, itemPrice, itemWeight float64) Product {
    s.mu.Lock()
    defer s.mu.Unlock()

    unitCost := itemPrice / itemWeight
    status := "stable"
    if unitCost > 0.5 {
        status = "inflation-risk"
    }

    product := Product{
        ID:        s.nextID,
        ItemName:  itemName,
        ItemPrice: itemPrice,
        ItemWeight: itemWeight,
        UnitCost:  unitCost,
        Status:    status,
    }

    s.nextID++
    s.items = append([]Product{product}, s.items...)
    return product
}

func (s *AppState) listProducts() []Product {
    s.mu.Lock()
    defer s.mu.Unlock()
    out := make([]Product, len(s.items))
    copy(out, s.items)
    return out
}

func apiHealth(w http.ResponseWriter, _ *http.Request) {
    w.Header().Set("Content-Type", "application/json")
    _ = json.NewEncoder(w).Encode(map[string]any{"ok": true, "database": "memory"})
}

func handleProducts(w http.ResponseWriter, r *http.Request, state *AppState) {
    switch r.Method {
    case http.MethodGet:
        w.Header().Set("Content-Type", "application/json")
        _ = json.NewEncoder(w).Encode(state.listProducts())
    case http.MethodPost:
        var payload map[string]any
        if err := json.NewDecoder(r.Body).Decode(&payload); err != nil {
            http.Error(w, `{"error":"invalid JSON"}`, http.StatusBadRequest)
            return
        }

        itemName, _ := payload["itemName"].(string)
        itemPrice, _ := strconv.ParseFloat(fmt.Sprint(payload["itemPrice"]), 64)
        itemWeight, _ := strconv.ParseFloat(fmt.Sprint(payload["itemWeight"]), 64)

        itemName = strings.TrimSpace(itemName)
        if itemName == "" || itemPrice <= 0 || itemWeight <= 0 {
            http.Error(w, `{"error":"itemName, itemPrice and itemWeight are required"}`, http.StatusBadRequest)
            return
        }

        product := state.addProduct(itemName, itemPrice, itemWeight)
        w.Header().Set("Content-Type", "application/json")
        w.WriteHeader(http.StatusCreated)
        _ = json.NewEncoder(w).Encode(product)
    default:
        http.Error(w, `{"error":"method not allowed"}`, http.StatusMethodNotAllowed)
    }
}

func serveFile(w http.ResponseWriter, r *http.Request) {
    reqPath := r.URL.Path
    if reqPath == "/" {
        reqPath = "/index.html"
    }

    cleanPath := filepath.Clean(strings.TrimPrefix(reqPath, "/"))
    if cleanPath == "." {
        cleanPath = "index.html"
    }

    if strings.HasPrefix(reqPath, "/api/") {
        http.NotFound(w, r)
        return
    }

    if _, err := os.Stat(cleanPath); err == nil {
        http.ServeFile(w, r, cleanPath)
        return
    }

    http.ServeFile(w, r, "index.html")
}

func main() {
    state := &AppState{nextID: 1}
    http.HandleFunc("/api/health", apiHealth)
    http.HandleFunc("/api/products", func(w http.ResponseWriter, r *http.Request) {
        handleProducts(w, r, state)
    })
    http.HandleFunc("/", serveFile)

    log.Println("Go fallback server running on http://localhost:3000")
    log.Fatal(http.ListenAndServe(":3000", nil))
}
