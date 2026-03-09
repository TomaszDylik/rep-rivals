package handler

import (
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"os"
	"sort"
	"time"
)

type setRow struct {
	Points float64 `json:"points"`
}

type exerciseRow struct {
	WorkoutID string   `json:"workout_id"`
	Sets      []setRow `json:"sets"`
}

type workoutRow struct {
	ID        string `json:"id"`
	UserID    string `json:"user_id"`
	CreatedAt string `json:"created_at"`
}

type userRow struct {
	ID       string `json:"id"`
	Username string `json:"username"`
}

type LeaderboardEntry struct {
	UserID      string  `json:"user_id"`
	Username    string  `json:"username"`
	TotalPoints float64 `json:"total_points"`
	Rank        int     `json:"rank"`
}

func Handler(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")
	w.Header().Set("Access-Control-Allow-Origin", "*")
	w.Header().Set("Access-Control-Allow-Methods", "GET, OPTIONS")
	w.Header().Set("Access-Control-Allow-Headers", "Content-Type, Authorization")

	if r.Method == http.MethodOptions {
		w.WriteHeader(http.StatusOK)
		return
	}
	if r.Method != http.MethodGet {
		http.Error(w, `{"error":"method not allowed"}`, http.StatusMethodNotAllowed)
		return
	}

	groupID := r.URL.Query().Get("groupId")
	if groupID == "" {
		http.Error(w, `{"error":"groupId is required"}`, http.StatusBadRequest)
		return
	}
	timeframe := r.URL.Query().Get("timeframe")
	if timeframe == "" {
		timeframe = "all"
	}

	supabaseURL := os.Getenv("NEXT_PUBLIC_SUPABASE_URL")
	supabaseKey := os.Getenv("NEXT_PUBLIC_SUPABASE_ANON_KEY")
	if supabaseURL == "" || supabaseKey == "" {
		http.Error(w, `{"error":"missing supabase config"}`, http.StatusInternalServerError)
		return
	}

	// Use the user's JWT token for RLS if provided, otherwise fall back to anon key
	authToken := r.Header.Get("Authorization")
	if authToken == "" {
		authToken = "Bearer " + supabaseKey
	}

	// 1. Fetch workouts for this group, optionally filtered by time
	workoutParams := url.Values{}
	workoutParams.Set("select", "id,user_id,created_at")
	workoutParams.Set("group_id", "eq."+groupID)
	workoutParams.Set("order", "created_at.desc")

	if timeframe == "week" {
		since := time.Now().UTC().AddDate(0, 0, -7).Format(time.RFC3339)
		workoutParams.Set("created_at", "gte."+since)
	} else if timeframe == "month" {
		since := time.Now().UTC().AddDate(0, -1, 0).Format(time.RFC3339)
		workoutParams.Set("created_at", "gte."+since)
	}

	workouts, err := supabaseGet[workoutRow](supabaseURL, supabaseKey, authToken, "workouts", workoutParams)
	if err != nil {
		http.Error(w, fmt.Sprintf(`{"error":"%s"}`, err.Error()), http.StatusInternalServerError)
		return
	}

	if len(workouts) == 0 {
		json.NewEncoder(w).Encode([]LeaderboardEntry{})
		return
	}

	// collect workout IDs
	workoutIDs := make([]string, len(workouts))
	workoutUserMap := map[string]string{} // workout_id -> user_id
	userIDs := map[string]bool{}
	for i, wo := range workouts {
		workoutIDs[i] = wo.ID
		workoutUserMap[wo.ID] = wo.UserID
		userIDs[wo.UserID] = true
	}

	// 2. Fetch exercises for these workouts (with nested sets)
	// Supabase REST API supports "in" filter
	exParams := url.Values{}
	exParams.Set("select", "workout_id,sets(points)")
	inFilter := "("
	for i, wid := range workoutIDs {
		if i > 0 {
			inFilter += ","
		}
		inFilter += wid
	}
	inFilter += ")"
	exParams.Set("workout_id", "in."+inFilter)

	exercises, err := supabaseGet[exerciseRow](supabaseURL, supabaseKey, authToken, "exercises", exParams)
	if err != nil {
		http.Error(w, fmt.Sprintf(`{"error":"%s"}`, err.Error()), http.StatusInternalServerError)
		return
	}

	// 3. Sum points per user
	pointsPerUser := map[string]float64{}
	for _, ex := range exercises {
		uid := workoutUserMap[ex.WorkoutID]
		for _, s := range ex.Sets {
			pointsPerUser[uid] += s.Points
		}
	}

	// 4. Fetch usernames
	userIDList := make([]string, 0, len(userIDs))
	for uid := range userIDs {
		userIDList = append(userIDList, uid)
	}

	usrParams := url.Values{}
	usrParams.Set("select", "id,username")
	usrInFilter := "("
	for i, uid := range userIDList {
		if i > 0 {
			usrInFilter += ","
		}
		usrInFilter += uid
	}
	usrInFilter += ")"
	usrParams.Set("id", "in."+usrInFilter)

	users, err := supabaseGet[userRow](supabaseURL, supabaseKey, authToken, "users", usrParams)
	if err != nil {
		http.Error(w, fmt.Sprintf(`{"error":"%s"}`, err.Error()), http.StatusInternalServerError)
		return
	}

	usernameMap := map[string]string{}
	for _, u := range users {
		usernameMap[u.ID] = u.Username
	}

	// 5. Build leaderboard
	entries := make([]LeaderboardEntry, 0, len(pointsPerUser))
	for uid, pts := range pointsPerUser {
		entries = append(entries, LeaderboardEntry{
			UserID:      uid,
			Username:    usernameMap[uid],
			TotalPoints: pts,
		})
	}

	sort.Slice(entries, func(i, j int) bool {
		return entries[i].TotalPoints > entries[j].TotalPoints
	})

	for i := range entries {
		entries[i].Rank = i + 1
	}

	// Also include users with 0 points who are in the group but had no workouts in timeframe
	// (not strictly required but nice-to-have — skip for now to keep it simple)

	json.NewEncoder(w).Encode(entries)
}

func supabaseGet[T any](baseURL, apiKey, authToken, table string, params url.Values) ([]T, error) {
	endpoint := fmt.Sprintf("%s/rest/v1/%s?%s", baseURL, table, params.Encode())
	req, err := http.NewRequest("GET", endpoint, nil)
	if err != nil {
		return nil, err
	}
	req.Header.Set("apikey", apiKey)
	req.Header.Set("Authorization", authToken)
	req.Header.Set("Content-Type", "application/json")

	resp, err := http.DefaultClient.Do(req)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		body, _ := io.ReadAll(resp.Body)
		return nil, fmt.Errorf("supabase %s returned %d: %s", table, resp.StatusCode, string(body))
	}

	var result []T
	if err := json.NewDecoder(resp.Body).Decode(&result); err != nil {
		return nil, err
	}
	return result, nil
}
