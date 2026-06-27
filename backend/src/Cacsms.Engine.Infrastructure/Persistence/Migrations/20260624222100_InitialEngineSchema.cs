using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Cacsms.Engine.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class InitialEngineSchema : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.EnsureSchema(
                name: "engine");

            migrationBuilder.CreateTable(
                name: "decision_records",
                schema: "engine",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    created_at = table.Column<DateTimeOffset>(type: "datetimeoffset", nullable: false),
                    symbol = table.Column<string>(type: "nvarchar(32)", maxLength: 32, nullable: false),
                    trading_mode = table.Column<string>(type: "nvarchar(64)", maxLength: 64, nullable: false),
                    recommendation = table.Column<string>(type: "nvarchar(64)", maxLength: 64, nullable: false),
                    direction = table.Column<string>(type: "nvarchar(32)", maxLength: 32, nullable: false),
                    confidence_score = table.Column<decimal>(type: "decimal(5,4)", precision: 5, scale: 4, nullable: false),
                    request_json = table.Column<string>(type: "nvarchar(max)", nullable: false),
                    response_json = table.Column<string>(type: "nvarchar(max)", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_decision_records", x => x.id);
                });

            migrationBuilder.CreateIndex(
                name: "ix_decision_records_created_at",
                schema: "engine",
                table: "decision_records",
                column: "created_at",
                descending: new bool[0]);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "decision_records",
                schema: "engine");
        }
    }
}
