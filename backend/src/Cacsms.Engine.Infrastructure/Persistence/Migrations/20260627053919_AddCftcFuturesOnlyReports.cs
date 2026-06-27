using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Cacsms.Engine.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class AddCftcFuturesOnlyReports : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "cftc_futures_only_reports",
                schema: "engine",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    report_date = table.Column<DateOnly>(type: "date", nullable: false),
                    report_year = table.Column<int>(type: "int", nullable: false),
                    market_name = table.Column<string>(type: "nvarchar(180)", maxLength: 180, nullable: false),
                    contract_market_code = table.Column<string>(type: "nvarchar(16)", maxLength: 16, nullable: false),
                    market_code = table.Column<string>(type: "nvarchar(16)", maxLength: 16, nullable: false),
                    commodity_code = table.Column<string>(type: "nvarchar(16)", maxLength: 16, nullable: false),
                    open_interest = table.Column<int>(type: "int", nullable: false),
                    non_commercial_long = table.Column<int>(type: "int", nullable: false),
                    non_commercial_short = table.Column<int>(type: "int", nullable: false),
                    non_commercial_spreading = table.Column<int>(type: "int", nullable: false),
                    commercial_long = table.Column<int>(type: "int", nullable: false),
                    commercial_short = table.Column<int>(type: "int", nullable: false),
                    non_reportable_long = table.Column<int>(type: "int", nullable: false),
                    non_reportable_short = table.Column<int>(type: "int", nullable: false),
                    change_open_interest = table.Column<int>(type: "int", nullable: false),
                    change_non_commercial_long = table.Column<int>(type: "int", nullable: false),
                    change_non_commercial_short = table.Column<int>(type: "int", nullable: false),
                    change_commercial_long = table.Column<int>(type: "int", nullable: false),
                    change_commercial_short = table.Column<int>(type: "int", nullable: false),
                    total_traders = table.Column<int>(type: "int", nullable: false),
                    contract_units = table.Column<string>(type: "nvarchar(180)", maxLength: 180, nullable: false),
                    source_url = table.Column<string>(type: "nvarchar(300)", maxLength: 300, nullable: false),
                    synced_at = table.Column<DateTimeOffset>(type: "datetimeoffset", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_cftc_futures_only_reports", x => x.id);
                });

            migrationBuilder.CreateIndex(
                name: "ix_cftc_futures_only_reports_report_date",
                schema: "engine",
                table: "cftc_futures_only_reports",
                column: "report_date",
                descending: new bool[0]);

            migrationBuilder.CreateIndex(
                name: "ux_cftc_futures_only_reports_date_contract",
                schema: "engine",
                table: "cftc_futures_only_reports",
                columns: new[] { "report_date", "contract_market_code" },
                unique: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "cftc_futures_only_reports",
                schema: "engine");
        }
    }
}
