package main

import (
	"database/sql"
	"fmt"
	"log"
	"net/http"
	"os"
	"time"

	"github.com/gin-gonic/gin"
	_ "github.com/go-sql-driver/mysql"
	"golang.org/x/crypto/bcrypt"
)

var db *sql.DB

type User struct {
	ID          int    `json:"id"`
	Code        string `json:"code"`
	Name        string `json:"name"`
	Email       string `json:"email"`
	PhoneNumber string `json:"phone_number"`
	Password    string `json:"-"`
	CreatedAt   string `json:"created_at"`
}

func generateCode() string {
	date := time.Now().Format("20060102")
	random := fmt.Sprintf("%06d", time.Now().UnixNano()%1000000)
	return date + random
}

func connectDB() {
	var err error
	db, err = sql.Open("mysql", fmt.Sprintf("%s:%s@tcp(%s)/%s",
		os.Getenv("DB_USER"),
		os.Getenv("DB_PASSWORD"),
		os.Getenv("DB_HOST"),
		os.Getenv("DB_NAME"),
	))
	if err != nil {
		log.Fatal(err)
	}
	if err = db.Ping(); err != nil {
		log.Fatal(err)
	}
	fmt.Println("Connected to MySQL!")
}

func createUser(c *gin.Context) {
	var user User
	if err := c.ShouldBindJSON(&user); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	hashedPassword, err := bcrypt.GenerateFromPassword([]byte(user.Password), bcrypt.DefaultCost)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to hash password"})
		return
	}
	user.Password = string(hashedPassword)

	user.Code = generateCode()

	query := `INSERT INTO users (code, name, email, phone_number, password) VALUES (?, ?, ?, ?, ?)`
	result, err := db.Exec(query, user.Code, user.Name, user.Email, user.PhoneNumber, user.Password)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	userID, _ := result.LastInsertId()
	c.JSON(http.StatusCreated, gin.H{"id": userID, "code": user.Code, "name": user.Name, "email": user.Email, "phone_number": user.PhoneNumber})
}

func main() {
	connectDB()
	r := gin.Default()

	r.POST("/users", createUser)
	r.GET("/users", func(c *gin.Context) {
		var users []User
		query := `SELECT id, code, name, email, phone_number, created_at FROM users`
		rows, err := db.Query(query)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}
		defer rows.Close()
		for rows.Next() {
			var user User
			rows.Scan(&user.ID, &user.Code, &user.Name, &user.Email, &user.PhoneNumber, &user.CreatedAt)
			users = append(users, user)
		}
		c.JSON(http.StatusOK, users)
	})

	port := os.Getenv("PORT")
	if port == "" {
		port = "3000"
	}
	r.Run(":" + port)
}